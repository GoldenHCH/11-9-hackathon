import type { estypes } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { recommendPeopleFor } from '../match/people';
import { recommendTalksFor } from '../match/talks';
import { logger } from '../observability/logger';
import { photoQuestCandidates } from '../photos/photo-quests';
import { gameRules, materialCatalog, walkTimes, xpRewards } from '../types/kubequest.constants';
import { IAttendee, IBannerProgress, ILocation, IPersonMatch, IQuest, ITalk, ITalkMatch, IXpEvent } from '../types/kubequest.interfaces';
import { QuestType } from '../types/kubequest.types';
import { walkMinutes } from '../world/walk';
import { bannerProgress } from '../xp/banners';
import { nearbyCandidates, proximityRank, questsNearPlayer } from './proximity';
import { placeOf, questId, talkPlace, walkPointOf } from './store';
import { addMinutes, endOfConferenceDay, minutesUntil } from './time';

export interface IOfferContext {
  attendee: IAttendee;
  now: Date;
  here?: ILocation;
  eventsToday: IXpEvent[];
  allEvents: IXpEvent[];
  avoidFar: boolean;
}

export interface ICandidate {
  quest: IQuest;
  priority: number;
}

const OFFER_PRIORITY: Record<QuestType, number> = { boss: 0, quiz: 1, chat: 2, attend: 3, outpost: 4, photo: 4, collection: 5 };
const CANDIDATE_LIMIT = 6;
const QUIZ_XP = xpRewards.QUIZ_CORRECT_ANSWER * gameRules.QUIZ_QUESTIONS;
const BOSS_XP = xpRewards.BOSS_CORRECT_ANSWER * gameRules.BOSS_QUESTIONS + xpRewards.BOSS_DEFEATED_BONUS;

function topicsOf(attendee: IAttendee): string[] {
  return attendee.profile.topics;
}

function topicText(attendee: IAttendee): string {
  return [...topicsOf(attendee), attendee.workingOn].filter((value) => value.trim() !== '').join(' ');
}

function baseQuest(context: IOfferContext, type: QuestType, targetId: string): Pick<IQuest, 'id' | 'attendeeId' | 'type' | 'status' | 'source' | 'offeredAt'> {
  return {
    id: questId(context.attendee.id, type, targetId),
    attendeeId: context.attendee.id,
    type,
    status: 'offered',
    source: 'board',
    offeredAt: context.now.toISOString(),
  };
}

async function safely<T>(label: string, run: () => Promise<T[]>): Promise<T[]> {
  try {
    return await run();
  } catch (error) {
    logger.debug({ err: error, source: label }, 'quest offer source unavailable');

    return [];
  }
}

function walkFrom(context: IOfferContext, location: ILocation | undefined, fallback?: number): number | undefined {
  return fallback ?? walkMinutes(walkPointOf(context.here), walkPointOf(location));
}

export function attendQuest(context: IOfferContext, talk: ITalk, location: ILocation | undefined, reason: string, walk?: number): IQuest {
  const where = talkPlace(talk, location);
  const startsIn = minutesUntil(context.now, talk.start);

  return {
    ...baseQuest(context, 'attend', talk.id),
    title: `Attend "${talk.title}"`,
    reason,
    nextStep: startsIn > 0 ? `Head to ${where.name}; it starts in ${startsIn} min. Scan the room's QR during the session.` : `Scan the QR in ${where.name} during the session.`,
    reward: { xp: xpRewards.CHECK_IN, material: talk.material, label: `${xpRewards.CHECK_IN} XP + 1 ${materialCatalog[talk.material].label} block` },
    where,
    when: { start: talk.start, end: talk.end },
    walkMinutes: walkFrom(context, location, walk),
    talkId: talk.id,
    locationId: talk.locationId,
    expiresAt: talk.start,
  };
}

export function outpostQuest(context: IOfferContext, location: ILocation, reason: string): IQuest {
  const ask = location.askAbout ? ` Ask them about ${location.askAbout}.` : '';

  return {
    ...baseQuest(context, 'outpost', location.id),
    title: `Visit ${location.name}`,
    reason,
    nextStep: `Find ${location.name}${location.boothNumber ? ` at booth ${location.boothNumber}` : ''} and scan the QR block on its table.${ask}`,
    reward: { xp: xpRewards.OUTPOST, label: `${xpRewards.OUTPOST} XP` },
    where: placeOf(location),
    walkMinutes: walkFrom(context, location),
    locationId: location.id,
    expiresAt: endOfConferenceDay(context.now).toISOString(),
  };
}

function quizQuest(context: IOfferContext, talk: ITalk, reason: string): IQuest {
  return {
    ...baseQuest(context, 'quiz', talk.id),
    title: `Quiz: "${talk.title}"`,
    reason,
    nextStep: 'Answer 3 questions any time today. No timer.',
    reward: { xp: QUIZ_XP, label: `${xpRewards.QUIZ_CORRECT_ANSWER} XP per correct answer` },
    when: { start: talk.start, end: talk.end },
    walkMinutes: walkTimes.SAME_ROOM,
    talkId: talk.id,
    expiresAt: endOfConferenceDay(context.now).toISOString(),
  };
}

function bossQuest(context: IOfferContext, talk: ITalk): IQuest {
  return {
    ...baseQuest(context, 'boss', talk.id),
    title: `Defeat the boss: "${talk.title}"`,
    reason: 'You are in a boss room. The whole room fights together.',
    nextStep: 'Answer the 5-question boss quiz. Every correct answer takes 1 point off its health.',
    reward: { xp: BOSS_XP, material: 'gold', label: `${xpRewards.BOSS_CORRECT_ANSWER} XP per correct answer, +${xpRewards.BOSS_DEFEATED_BONUS} XP and 1 Gold block if it falls` },
    where: talkPlace(talk, context.here),
    when: { start: talk.start, end: talk.end },
    walkMinutes: walkTimes.SAME_ROOM,
    talkId: talk.id,
    locationId: talk.locationId,
    expiresAt: addMinutes(new Date(talk.end), gameRules.BOSS_GRACE_MINUTES).toISOString(),
  };
}

export function chatQuest(context: IOfferContext, match: IPersonMatch): IQuest {
  const partner = match.player;
  const firstTimer = partner.firstTimer || context.attendee.profile.firstTimer;
  const xp = xpRewards.MEET + (firstTimer ? xpRewards.MEET_FIRST_TIMER_BONUS : 0);
  const topic = match.sharedTopics[0] ?? partner.workingOn;

  return {
    ...baseQuest(context, 'chat', partner.id),
    title: `Meet @${partner.handle}`,
    reason: match.reason || (topic ? `You both work on ${topic}.` : 'You are working on similar things.'),
    nextStep: topic ? `Accept, then meet at the campfire. Ask @${partner.handle} about ${topic}.` : 'Accept, then meet at the campfire the game picks.',
    reward: { xp, gems: 1, label: `${xp} XP + 1 gem each` },
    walkMinutes: match.sameRoom ? walkTimes.SAME_ROOM : undefined,
    partnerId: partner.id,
    expiresAt: addMinutes(context.now, gameRules.MEET_OFFER_MINUTES).toISOString(),
  };
}

function collectionQuest(context: IOfferContext, banner: IBannerProgress): IQuest {
  return {
    ...baseQuest(context, 'collection', banner.id),
    title: `Banner: ${banner.name}`,
    reason: `You are ${banner.progress} of ${banner.target} of the way there.`,
    nextStep: banner.description,
    reward: { xp: 0, banner: banner.id, label: `The ${banner.name} banner` },
    progress: { current: banner.progress, target: banner.target },
  };
}

function checkedInTalkIds(events: IXpEvent[]): string[] {
  return [...new Set(events.filter((event) => event.type === 'check_in' && event.talkId).map((event) => event.talkId as string))];
}

function quizzedTalkIds(events: IXpEvent[]): Set<string> {
  return new Set(events.filter((event) => event.type === 'quiz' && event.talkId).map((event) => event.talkId as string));
}

async function searchDocs<T>(index: string, query: estypes.QueryDslQueryContainer, size: number, sort?: estypes.Sort): Promise<T[]> {
  const response = await getEsClient().search<T>({ index, size, query, sort }, esOptions(esTimeouts.SEARCH_MS));

  return response.hits.hits.flatMap((hit) => (hit._source ? [hit._source] : []));
}

async function talksByIds(ids: string[]): Promise<ITalk[]> {
  return ids.length === 0 ? [] : searchDocs<ITalk>(indexNames.TALKS, { ids: { values: ids } }, ids.length);
}

async function fallbackTalkMatches(context: IOfferContext): Promise<ITalkMatch[]> {
  const windowEnd = addMinutes(context.now, gameRules.ATTEND_OFFER_WINDOW_MINUTES).toISOString();
  const text = topicText(context.attendee);
  const talks = await searchDocs<ITalk>(
    indexNames.TALKS,
    {
      bool: {
        filter: [{ range: { start: { gt: context.now.toISOString(), lte: windowEnd } } }],
        should: text ? [{ multi_match: { query: text, fields: ['title^2', 'abstract'] } }] : [],
      },
    },
    CANDIDATE_LIMIT,
  );

  return talks.map((talk) => ({
    talk,
    score: 0,
    reason: 'Starting soon and close to what you are working on.',
    startsInMinutes: minutesUntil(context.now, talk.start),
  }));
}

async function attendCandidates(context: IOfferContext): Promise<IQuest[]> {
  if (context.attendee.settings.noWalking) {
    return [];
  }

  const checkedIn = new Set(checkedInTalkIds(context.allEvents));
  let matches: ITalkMatch[];

  try {
    matches = await recommendTalksFor(context.attendee.id, { withinMinutes: gameRules.ATTEND_OFFER_WINDOW_MINUTES, limit: CANDIDATE_LIMIT });
  } catch (error) {
    logger.debug({ err: error }, 'recommendTalksFor unavailable, using plain talk query');
    matches = await fallbackTalkMatches(context);
  }

  return matches
    .filter((match) => !checkedIn.has(match.talk.id) && match.talk.start > context.now.toISOString())
    .filter((match) => match.startsInMinutes <= gameRules.ATTEND_OFFER_WINDOW_MINUTES)
    .map((match) => attendQuest(context, match.talk, match.location, match.reason, match.walkMinutes));
}

async function quizCandidates(context: IOfferContext): Promise<IQuest[]> {
  const quizzed = quizzedTalkIds(context.allEvents);
  const pending = checkedInTalkIds(context.eventsToday).filter((talkId) => !quizzed.has(talkId));
  const talks = await talksByIds(pending);
  const quests = talks.map((talk) => quizQuest(context, talk, 'You checked in to this talk. Prove you listened.'));

  if (!context.attendee.settings.noWalking) {
    return quests;
  }

  const text = topicText(context.attendee);
  const elsewhere = await searchDocs<ITalk>(
    indexNames.TALKS,
    {
      bool: {
        filter: [{ range: { start: { lte: context.now.toISOString(), gte: addMinutes(context.now, -12 * 60).toISOString() } } }],
        must_not: context.here ? [{ term: { locationId: context.here.id } }] : [],
        should: text ? [{ multi_match: { query: text, fields: ['title^2', 'abstract'] } }] : [],
      },
    },
    CANDIDATE_LIMIT,
  );
  const seen = new Set([...pending, ...quizzed]);

  return [
    ...quests,
    ...elsewhere
      .filter((talk) => !seen.has(talk.id) && !talk.isBoss)
      .map((talk) => quizQuest(context, talk, 'No walking needed: a quiz on a talk happening elsewhere, from its abstract or transcript.')),
  ];
}

async function fallbackPeople(context: IOfferContext, hereOnly: boolean): Promise<IPersonMatch[]> {
  const attendee = context.attendee;
  const filter: estypes.QueryDslQueryContainer[] = [{ term: { 'settings.meetingOn': true } }, { term: { visible: true } }];

  if (hereOnly) {
    if (!attendee.lastLocationId) {
      return [];
    }

    filter.push({ term: { lastLocationId: attendee.lastLocationId } });
  }

  const people = await searchDocs<IAttendee>(
    indexNames.ATTENDEES,
    {
      bool: {
        filter,
        must_not: [{ ids: { values: [attendee.id, ...attendee.blockedIds] } }, { term: { blockedIds: attendee.id } }],
        should: topicsOf(attendee).length > 0 ? [{ terms: { 'profile.topics': topicsOf(attendee) } }] : [],
        minimum_should_match: topicsOf(attendee).length > 0 ? 1 : 0,
      },
    },
    3,
  );

  return people.map((person) => {
    const sharedTopics = person.profile.topics.filter((topic) => topicsOf(attendee).includes(topic));

    return {
      player: {
        id: person.id,
        handle: person.handle,
        faceSeed: person.faceSeed,
        level: person.level,
        levelName: '',
        xp: person.xp,
        banners: person.banners,
        isSpeaker: person.isSpeaker,
        topics: person.profile.topics,
        workingOn: person.workingOn,
        firstTimer: person.profile.firstTimer,
      },
      score: sharedTopics.length,
      sharedTopics,
      reason: sharedTopics.length > 0 ? `You both work on ${sharedTopics.join(', ')}.` : `@${person.handle} is working on ${person.workingOn}.`,
      sameRoom: person.lastLocationId !== undefined && person.lastLocationId === attendee.lastLocationId,
    };
  });
}

async function chatCandidates(context: IOfferContext): Promise<IQuest[]> {
  if (!context.attendee.settings.meetingOn) {
    return [];
  }

  const hereOnly = context.attendee.settings.noWalking;
  let matches: IPersonMatch[];

  try {
    matches = await recommendPeopleFor(context.attendee.id, { hereOnly, limit: 3 });
  } catch (error) {
    logger.debug({ err: error }, 'recommendPeopleFor unavailable, using plain attendee query');
    matches = await fallbackPeople(context, hereOnly);
  }

  return matches
    .filter((match) => match.meetStatus === undefined && (!hereOnly || match.sameRoom))
    .map((match) => chatQuest(context, match));
}

async function outpostCandidates(context: IOfferContext): Promise<IQuest[]> {
  if (context.attendee.settings.noWalking) {
    return [];
  }

  const visitsToday = context.eventsToday.filter((event) => event.type === 'outpost').length;

  if (visitsToday >= gameRules.OUTPOSTS_PER_DAY) {
    return [];
  }

  const visited = context.allEvents.filter((event) => event.type === 'outpost' && event.locationId).map((event) => event.locationId as string);
  const text = topicText(context.attendee);
  const outposts = await searchDocs<ILocation>(
    indexNames.LOCATIONS,
    {
      bool: {
        filter: [{ term: { kind: 'outpost' } }],
        must_not: visited.length > 0 ? [{ ids: { values: visited } }] : [],
        should: [
          ...(topicsOf(context.attendee).length > 0 ? [{ terms: { topics: topicsOf(context.attendee) } }] : []),
          ...(text ? [{ multi_match: { query: text, fields: ['name^2', 'description', 'askAbout'] } }] : []),
        ],
      },
    },
    3,
  );

  return outposts.map((location) =>
    outpostQuest(context, location, location.topics && location.topics.length > 0 ? `It covers ${location.topics.slice(0, 2).join(' and ')}.` : 'It matches what you are working on.'),
  );
}

async function bossCandidates(context: IOfferContext): Promise<IQuest[]> {
  if (!context.here) {
    return [];
  }

  const nowIso = context.now.toISOString();
  const talks = await searchDocs<ITalk>(
    indexNames.TALKS,
    {
      bool: {
        filter: [
          { term: { locationId: context.here.id } },
          { term: { isBoss: true } },
          { range: { start: { lte: addMinutes(context.now, gameRules.SESSION_GRACE_MINUTES).toISOString() } } },
          { range: { end: { gte: addMinutes(context.now, -gameRules.BOSS_GRACE_MINUTES).toISOString() } } },
        ],
      },
    },
    1,
  );
  const checkedIn = new Set(checkedInTalkIds(context.eventsToday));

  return talks.filter((talk) => checkedIn.has(talk.id) || context.here?.kind === 'boss-room' || talk.start <= nowIso).map((talk) => bossQuest(context, talk));
}

async function collectionCandidates(context: IOfferContext): Promise<IQuest[]> {
  const banners = await bannerProgress(context.attendee.id);
  const next = banners
    .filter((banner) => !banner.earned && banner.id !== 'speaker')
    .sort((left, right) => right.progress / right.target - left.progress / left.target)[0];

  return next ? [collectionQuest(context, next)] : [];
}

export async function generateCandidates(context: IOfferContext): Promise<ICandidate[]> {
  const sources: [string, () => Promise<IQuest[]>][] = [
    ['boss', () => bossCandidates(context)],
    ['quiz', () => quizCandidates(context)],
    ['chat', () => chatCandidates(context)],
    ['attend', () => attendCandidates(context)],
    ['outpost', () => outpostCandidates(context)],
    ['photo', () => photoQuestCandidates(context)],
    ['collection', () => collectionCandidates(context)],
    ['nearby', () => nearbyCandidates(context)],
  ];
  const results = await Promise.all(sources.map(([label, run]) => safely(label, run)));
  const quests = (await questsNearPlayer(context, results.flat())).filter((quest) => !context.avoidFar || (quest.walkMinutes ?? 0) < walkTimes.OTHER_BUILDING);

  return quests.map((quest) => ({ quest, priority: OFFER_PRIORITY[quest.type] + proximityRank(quest) }));
}

export function pickOffers(candidates: ICandidate[], count: number): IQuest[] {
  const byType = new Map<QuestType, IQuest[]>();

  for (const candidate of [...candidates].sort((left, right) => left.priority - right.priority)) {
    const list = byType.get(candidate.quest.type) ?? [];
    list.push(candidate.quest);
    byType.set(candidate.quest.type, list);
  }

  const picked: IQuest[] = [];
  const seen = new Set<string>();

  while (picked.length < count && [...byType.values()].some((list) => list.length > 0)) {
    for (const list of byType.values()) {
      const next = list.shift();

      if (next && !seen.has(next.id) && picked.length < count) {
        seen.add(next.id);
        picked.push(next);
      }
    }
  }

  return picked;
}
