import type { estypes } from '@elastic/elasticsearch';
import { boothNotePending } from '../booth/booth-notes';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { sharedTopics, toMatchPlayer } from '../match/match-data';
import { IWalkPoint } from '../types/internal.interfaces';
import { gameRules, walkTimes } from '../types/kubequest.constants';
import { IAttendee, ILocation, IPersonMatch, IQuest, IQuestPlace, ITalk } from '../types/kubequest.interfaces';
import { QuestType } from '../types/kubequest.types';
import { buildingNames, levelNumber } from '../world/locations';
import { walkMinutes } from '../world/walk';
import { attendQuest, chatQuest, IOfferContext, outpostQuest } from './offers';
import { loadLocation, placeOf, walkPointOf } from './store';
import { addMinutes, minutesUntil } from './time';

export const proximityRules = {
  ANCHOR_LOCATION_ID: 'cloud-native-hackathon',
  NEAR_MAX_WALK: 5,
  WIDE_MAX_WALK: 8,
  MIN_OFFERS: 2,
  PEOPLE_SEEN_MINUTES: 120,
  PEOPLE_RADIUS: '400m',
  PEOPLE_LIMIT: 3,
  OUTPOST_LIMIT: 3,
  TALK_LIMIT: 2,
  LATER_TALK_HOURS: 24,
} as const;

export const hereNoteHint = 'You’re here: add your note';
export const noLocationHint = 'Scan any QR to get quests near you';
export const skybridgeLabel = `Across the skybridge · ${walkTimes.OTHER_BUILDING} min`;

const LOCATED_TYPES = new Set<QuestType>(['attend', 'outpost', 'photo', 'chat']);
const originCache = new WeakMap<IOfferContext, Promise<ILocation | undefined>>();

function originOf(context: IOfferContext): Promise<ILocation | undefined> {
  const cached = originCache.get(context);

  if (cached) {
    return cached;
  }

  const origin = context.here ? Promise.resolve(context.here) : loadLocation(proximityRules.ANCHOR_LOCATION_ID).catch(() => undefined);
  originCache.set(context, origin);

  return origin;
}

function shortBuilding(building: string): string {
  return building === buildingNames.HYATT_REGENCY ? 'Hyatt' : building;
}

export function directionHint(from: IWalkPoint | undefined, to: IQuestPlace | undefined): string | undefined {
  if (!from || !to) {
    return undefined;
  }

  if (from.id === to.locationId) {
    return 'You are here';
  }

  if (from.building !== to.building) {
    return `${shortBuilding(to.building)} via skybridge`;
  }

  const floors = levelNumber(to.level) - levelNumber(from.level);

  if (floors === 0 || !Number.isFinite(floors)) {
    return 'Same floor';
  }

  const count = Math.abs(floors);
  const amount = count === 1 ? 'One floor' : `${count} floors`;

  return `${amount} ${floors > 0 ? 'up' : 'down'}`;
}

function located(quest: IQuest): boolean {
  return LOCATED_TYPES.has(quest.type) && quest.where !== undefined;
}

function placeFromOrigin(quest: IQuest, origin: ILocation | undefined): IQuest {
  if (quest.type === 'quiz') {
    return { ...quest, walkMinutes: walkTimes.SAME_ROOM, directionHint: 'No walking needed' };
  }

  if (!quest.where || !origin) {
    return quest;
  }

  const from = walkPointOf(origin);
  const to: IWalkPoint = { id: quest.where.locationId, building: quest.where.building, level: quest.where.level };
  const walk = walkMinutes(from, to);
  const farLabel = walk !== undefined && walk >= walkTimes.OTHER_BUILDING ? { distanceLabel: skybridgeLabel } : {};

  return { ...quest, walkMinutes: walk, directionHint: directionHint(from, quest.where), ...farLabel };
}

function dedupe(quests: IQuest[]): IQuest[] {
  const byId = new Map<string, IQuest>();

  for (const quest of quests) {
    const existing = byId.get(quest.id);

    if (!existing || (existing.where === undefined && quest.where !== undefined)) {
      byId.set(quest.id, quest);
    }
  }

  return [...byId.values()];
}

export function proximityRank(quest: IQuest): number {
  return located(quest) ? (quest.walkMinutes ?? walkTimes.OTHER_LEVEL) / 10 : 0;
}

export async function placeByProximity(context: IOfferContext, quests: IQuest[]): Promise<IQuest[]> {
  const origin = await originOf(context);
  const placed = dedupe(quests).map((quest) => placeFromOrigin(quest, origin));
  const isUnplacedChat = (quest: IQuest): boolean => quest.type === 'chat' && !quest.where;
  const rest = placed.filter((quest) => !isUnplacedChat(quest));
  const within = (limit: number): IQuest[] => rest.filter((quest) => !located(quest) || (quest.walkMinutes ?? 0) <= limit);
  const near = within(proximityRules.NEAR_MAX_WALK);
  const nearChat = near.some((quest) => quest.type === 'chat');
  const chats = nearChat ? [] : placed.filter(isUnplacedChat);
  const nearAll = [...near, ...chats];
  const widen = !near.some(located) || nearAll.length < proximityRules.MIN_OFFERS;
  const chosen = widen ? [...within(proximityRules.WIDE_MAX_WALK), ...chats] : nearAll;

  return chosen.sort((left, right) => proximityRank(left) - proximityRank(right));
}

async function search<T>(index: string, query: estypes.QueryDslQueryContainer, size: number, sort?: estypes.Sort): Promise<estypes.SearchHit<T>[]> {
  const response = await getEsClient().search<T>({ index, size, query, sort }, esOptions(esTimeouts.SEARCH_MS));

  return response.hits.hits;
}

function sources<T extends { id: string }>(hits: estypes.SearchHit<T>[]): T[] {
  return hits.flatMap((hit) => (hit._source ? [{ ...hit._source, id: hit._source.id ?? hit._id ?? '' }] : []));
}

async function nearbyOutposts(context: IOfferContext, origin: ILocation): Promise<IQuest[]> {
  const visitsToday = context.eventsToday.filter((event) => event.type === 'outpost').length;

  if (visitsToday >= gameRules.OUTPOSTS_PER_DAY) {
    return [];
  }

  const visited = context.allEvents.filter((event) => event.type === 'outpost' && event.locationId).map((event) => event.locationId as string);
  const topics = context.attendee.profile.topics;
  const hits = await search<ILocation>(
    indexNames.LOCATIONS,
    {
      bool: {
        filter: [{ term: { kind: 'outpost' } }, { term: { building: origin.building } }],
        must_not: visited.length > 0 ? [{ ids: { values: visited } }] : [],
        should: [{ term: { level: { value: origin.level, boost: 5 } } }, ...(topics.length > 0 ? [{ terms: { topics } }] : [])],
      },
    },
    proximityRules.OUTPOST_LIMIT * 4,
    [{ _score: { order: 'desc' } }, { _geo_distance: { geo: origin.geo, order: 'asc', unit: 'm' } }],
  );

  return sources(hits)
    .slice(0, proximityRules.OUTPOST_LIMIT)
    .map((location) => {
      const shared = (location.topics ?? []).filter((topic) => topics.includes(topic));

      return outpostQuest(context, location, shared.length > 0 ? `Close by, and it covers ${shared.slice(0, 2).join(' and ')}.` : 'It is a short walk from where you are.');
    });
}

async function nearbyTalks(context: IOfferContext, origin: ILocation): Promise<IQuest[]> {
  const checkedIn = new Set(context.allEvents.filter((event) => event.type === 'check_in' && event.talkId).map((event) => event.talkId as string));
  const hits = await search<ITalk>(
    indexNames.TALKS,
    {
      bool: {
        filter: [
          { term: { building: origin.building } },
          { range: { start: { gt: context.now.toISOString(), lte: addMinutes(context.now, proximityRules.LATER_TALK_HOURS * 60).toISOString() } } },
        ],
        must_not: [{ term: { isBoss: true } }],
      },
    },
    proximityRules.TALK_LIMIT * 3,
    [{ start: { order: 'asc' } }],
  );
  const talks = sources(hits).filter((talk) => !checkedIn.has(talk.id));
  const rooms = await Promise.all(talks.map((talk) => loadLocation(talk.locationId).catch(() => undefined)));

  return talks.slice(0, proximityRules.TALK_LIMIT).map((talk, index) => {
    const startsIn = minutesUntil(context.now, talk.start);
    const soon = startsIn <= gameRules.ATTEND_OFFER_WINDOW_MINUTES ? 'Starting soon' : 'Next up';

    return attendQuest(context, talk, rooms[index], `${soon} in this building.`);
  });
}

function personMatch(me: IAttendee, them: IAttendee, sameRoom: boolean): IPersonMatch {
  const shared = sharedTopics(me.profile?.topics ?? [], them.profile?.topics ?? []);
  const reason = shared.length > 0 ? `Nearby right now, and you both work on ${shared.slice(0, 2).join(' and ')}.` : `Nearby right now, working on ${them.workingOn}.`;

  return { player: toMatchPlayer(them), score: shared.length, sharedTopics: shared, reason, sameRoom };
}

async function nearbyPeople(context: IOfferContext, origin: ILocation): Promise<IQuest[]> {
  const me = context.attendee;

  if (!me.settings.meetingOn) {
    return [];
  }

  const center = me.lastLocation ?? origin.geo;
  const seenSince = addMinutes(context.now, -proximityRules.PEOPLE_SEEN_MINUTES).toISOString();
  const topics = me.profile.topics;
  const hits = await search<IAttendee>(
    indexNames.ATTENDEES,
    {
      bool: {
        filter: [
          { term: { visible: true } },
          { term: { 'settings.meetingOn': true } },
          { range: { lastSeenAt: { gte: seenSince } } },
          { geo_distance: { distance: proximityRules.PEOPLE_RADIUS, lastLocation: center } },
        ],
        must_not: [{ ids: { values: [me.id, ...me.blockedIds] } }, { term: { blockedIds: me.id } }],
        should: topics.length > 0 ? [{ terms: { 'profile.topics': topics } }] : [],
      },
    },
    proximityRules.PEOPLE_LIMIT * 4,
    [{ _geo_distance: { lastLocation: center, order: 'asc', unit: 'm' } }, { _score: { order: 'desc' } }],
  );
  const people = sources(hits);
  const rooms = await Promise.all(people.map((person) => loadLocation(person.lastLocationId).catch(() => undefined)));
  const sameBuilding = people
    .map((person, index) => ({ person, room: rooms[index] }))
    .filter((entry): entry is { person: IAttendee; room: ILocation } => entry.room !== undefined && entry.room.building === origin.building)
    .slice(0, proximityRules.PEOPLE_LIMIT);

  return sameBuilding.map(({ person, room }) => ({
    ...chatQuest(context, personMatch(me, person, person.lastLocationId === me.lastLocationId)),
    where: placeOf(room),
  }));
}

async function partnerPlaces(context: IOfferContext, quests: IQuest[]): Promise<Map<string, IQuestPlace>> {
  const seenSince = addMinutes(context.now, -proximityRules.PEOPLE_SEEN_MINUTES).toISOString();
  const ids = quests.filter((quest) => quest.type === 'chat' && quest.partnerId && !quest.where).map((quest) => quest.partnerId as string);

  if (ids.length === 0) {
    return new Map();
  }

  const people = sources(
    await search<IAttendee>(indexNames.ATTENDEES, { bool: { filter: [{ ids: { values: ids } }, { range: { lastSeenAt: { gte: seenSince } } }] } }, ids.length),
  );
  const rooms = await Promise.all(people.map((person) => loadLocation(person.lastLocationId).catch(() => undefined)));

  return new Map(people.flatMap((person, index) => (rooms[index] ? [[person.id, placeOf(rooms[index] as ILocation)] as const] : [])));
}

export async function locateChats(context: IOfferContext, quests: IQuest[]): Promise<IQuest[]> {
  const places = await partnerPlaces(context, quests).catch(() => new Map<string, IQuestPlace>());

  return quests.map((quest) => (quest.type === 'chat' && quest.partnerId && places.has(quest.partnerId) ? { ...quest, where: places.get(quest.partnerId) } : quest));
}

export async function nearbyCandidates(context: IOfferContext): Promise<IQuest[]> {
  if (context.attendee.settings.noWalking) {
    return [];
  }

  const origin = await originOf(context);

  if (!origin) {
    return [];
  }

  const results = await Promise.all([
    nearbyOutposts(context, origin).catch(() => []),
    nearbyTalks(context, origin).catch(() => []),
    nearbyPeople(context, origin).catch(() => []),
  ]);

  return results.flat();
}

const BOOTH_QUEST_TYPES = new Set<QuestType>(['outpost', 'photo']);

function boothLocationId(quest: IQuest): string | undefined {
  return quest.locationId ?? quest.where?.locationId;
}

export async function withoutCurrentBooth(context: IOfferContext, quests: IQuest[]): Promise<IQuest[]> {
  const hereId = context.attendee.lastLocationId;

  if (!hereId || !quests.some((quest) => BOOTH_QUEST_TYPES.has(quest.type) && boothLocationId(quest) === hereId)) {
    return quests;
  }

  const notePending = await boothNotePending(context.attendee.id, hereId).catch(() => false);

  return quests.flatMap((quest) => {
    if (!BOOTH_QUEST_TYPES.has(quest.type) || boothLocationId(quest) !== hereId) {
      return [quest];
    }

    if (quest.type !== 'outpost' || !notePending) {
      return [];
    }

    return [{ ...quest, directionHint: hereNoteHint, nextStep: 'Open your booth notes and add what you liked to finish this quest.' }];
  });
}

export async function questsNearPlayer(context: IOfferContext, quests: IQuest[]): Promise<IQuest[]> {
  return withoutCurrentBooth(context, await placeByProximity(context, await locateChats(context, quests)));
}
