import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { bossStateTool } from '../tools/boss-state.tool';
import { gameRules } from '../types/kubequest.constants';
import { IBossState, ILocation, INearbyCampfire, IPersonMatch, ITalk, IWhatsAroundMe } from '../types/kubequest.interfaces';
import { walkMinutes } from '../world/walk';
import { checkedInTalkIds, getAttendee, getLocations, hitSources, locationWalkPoint, talkSourceExcludes } from './match-data';
import { recommendPeopleFor } from './people';

export interface IWhatsAroundMeWithMatches extends IWhatsAroundMe {
  matchesHere: IPersonMatch[];
}

const quizWindowMinutes = 30;
const matchesHereLimit = 3;

async function roomTalks(locationId: string, nowMs: number): Promise<{ now?: ITalk; next?: ITalk; recent?: ITalk }> {
  const response = await getEsClient().search<ITalk>(
    {
      index: indexNames.TALKS,
      size: 3,
      _source_excludes: talkSourceExcludes,
      query: {
        bool: {
          filter: [{ term: { locationId } }, { range: { end: { gte: new Date(nowMs - quizWindowMinutes * 60000).toISOString() } } }],
        },
      },
      sort: [{ start: 'asc' }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );
  const talks = hitSources(response.hits.hits);
  const nowIso = new Date(nowMs).toISOString();
  const recent = talks.filter((talk) => talk.end < nowIso).pop();
  const now = talks.find((talk) => talk.start <= nowIso && talk.end >= nowIso);
  const next = talks.find((talk) => talk.start > nowIso);

  return { now, next, recent };
}

async function playersHere(locationId: string, nowMs: number): Promise<number> {
  const response = await getEsClient().count(
    {
      index: indexNames.ATTENDEES,
      query: {
        bool: {
          filter: [
            { term: { lastLocationId: locationId } },
            { range: { lastSeenAt: { gte: new Date(nowMs - gameRules.BUSYNESS_WINDOW_MINUTES * 60000).toISOString() } } },
          ],
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.count;
}

async function nearestCampfire(location: ILocation): Promise<INearbyCampfire | undefined> {
  if (!location.geo) {
    return undefined;
  }

  const response = await getEsClient().search<ILocation>(
    {
      index: indexNames.LOCATIONS,
      size: 1,
      _source_excludes: ['searchText'],
      query: { bool: { filter: [{ term: { kind: 'campfire' } }] } },
      sort: [{ _geo_distance: { geo: location.geo, order: 'asc', unit: 'm' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );
  const hit = response.hits.hits[0];

  if (!hit?._source) {
    return undefined;
  }

  const campfire: ILocation = { ...hit._source, id: hit._id ?? hit._source.id };
  const distance = hit.sort?.[0];

  return {
    location: campfire,
    walkMinutes: walkMinutes(locationWalkPoint(location), locationWalkPoint(campfire)),
    distanceMeters: typeof distance === 'number' ? Math.round(distance) : undefined,
  };
}

async function hasQuizEvent(attendeeId: string, talkId: string): Promise<boolean> {
  const response = await getEsClient().count(
    {
      index: indexNames.XP_EVENTS,
      query: { bool: { filter: [{ term: { attendeeId } }, { term: { talkId } }, { term: { type: 'quiz' } }] } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.count > 0;
}

async function bossFor(location: ILocation, now: ITalk | undefined): Promise<IBossState | undefined> {
  if (location.kind !== 'boss-room' && !now?.isBoss) {
    return undefined;
  }

  try {
    return await bossStateTool.run(now ? { talkId: now.id } : { locationId: location.id });
  } catch (error) {
    logger.debug({ err: error }, 'boss state unavailable');
    return undefined;
  }
}

async function safely<T>(label: string, fallback: T, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    logger.warn({ err: error, part: label }, 'whats_around_me part failed');
    return fallback;
  }
}

export async function whatsAroundMe(attendeeId: string): Promise<IWhatsAroundMeWithMatches> {
  const nowMs = Date.now();
  const me = await getAttendee(attendeeId);

  if (!me.lastLocationId) {
    return { playersHere: 0, quizAvailable: false, matchesHere: [] };
  }

  const locationId = me.lastLocationId;
  const location = (await getLocations([locationId])).get(locationId);

  if (!location) {
    return { playersHere: 0, quizAvailable: false, matchesHere: [] };
  }

  const [talks, count, campfire, attended, matchesHere] = await Promise.all([
    safely('talks', {}, () => roomTalks(locationId, nowMs)),
    safely('players', 0, () => playersHere(locationId, nowMs)),
    safely('campfire', undefined, () => nearestCampfire(location)),
    safely('checkins', new Set<string>(), () => checkedInTalkIds(attendeeId)),
    me.settings?.meetingOn ? safely('matches', [], () => recommendPeopleFor(attendeeId, { hereOnly: true, limit: matchesHereLimit })) : Promise.resolve([]),
  ]);

  const quizTalk = talks.now ?? talks.recent;
  const quizAvailable =
    quizTalk !== undefined && attended.has(quizTalk.id) && !(await safely('quiz', true, () => hasQuizEvent(attendeeId, quizTalk.id)));

  return {
    location,
    now: talks.now,
    next: talks.next,
    playersHere: count,
    quizAvailable,
    boss: await bossFor(location, talks.now),
    nearestCampfire: location.kind === 'campfire' ? { location, walkMinutes: 0, distanceMeters: 0 } : campfire,
    matchesHere,
  };
}
