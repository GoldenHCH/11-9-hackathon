import type { estypes } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { ToolError } from '../tools/tool-errors';
import { IAttendee, ILocation, IMatchPlayer, IQuestPlace, ITalk } from '../types/kubequest.interfaces';
import { IWalkPoint } from '../types/internal.interfaces';
import { walkMinutes } from '../world/walk';
import { levelDefinitionForXp } from '../xp/levels';

export const talkSourceExcludes = ['searchText', 'transcript', 'quiz', 'bossQuiz'];

export const attendeeSourceExcludes = ['profileText', 'email', 'displayName', 'summary', 'skills', 'offers', 'asks', 'itinerary', 'links', 'intent', 'seniority'];

export function hitSources<T>(hits: estypes.SearchHit<T>[]): T[] {
  return hits.flatMap((hit) => (hit._source ? [hit._source] : []));
}

export async function getAttendee(attendeeId: string): Promise<IAttendee> {
  try {
    const response = await getEsClient().get<IAttendee>({ index: indexNames.ATTENDEES, id: attendeeId }, esOptions());

    if (response._source) {
      return { ...response._source, id: response._id };
    }
  } catch (error) {
    if (!isNotFound(error)) {
      throw error;
    }
  }

  throw new ToolError(404, 'attendee_not_found', 'We could not find that player. Sign up first.');
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'statusCode') === 404;
}

export async function getLocations(ids: string[]): Promise<Map<string, ILocation>> {
  const unique = [...new Set(ids.filter((id) => id !== ''))];
  const locations = new Map<string, ILocation>();

  if (unique.length === 0) {
    return locations;
  }

  const response = await getEsClient().mget<ILocation>(
    { index: indexNames.LOCATIONS, ids: unique, _source_excludes: ['searchText'] },
    esOptions(),
  );

  for (const doc of response.docs) {
    if ('found' in doc && doc.found && doc._source) {
      locations.set(doc._id, { ...doc._source, id: doc._id });
    }
  }

  return locations;
}

export async function checkedInTalkIds(attendeeId: string): Promise<Set<string>> {
  const response = await getEsClient().search<{ talkId?: string }>(
    {
      index: indexNames.XP_EVENTS,
      size: 500,
      _source: ['talkId'],
      query: {
        bool: {
          filter: [{ term: { attendeeId } }, { term: { type: 'check_in' } }, { exists: { field: 'talkId' } }],
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return new Set(hitSources(response.hits.hits).flatMap((event) => (event.talkId ? [event.talkId] : [])));
}

export function locationWalkPoint(location: ILocation | undefined): IWalkPoint | undefined {
  return location ? { id: location.id, building: location.building, level: location.level } : undefined;
}

export function walkToTalk(from: IWalkPoint | undefined, talk: ITalk): number | undefined {
  return walkMinutes(from, { id: talk.locationId, building: talk.building, level: talk.level });
}

export function minutesUntil(iso: string, nowMs: number): number {
  return Math.max(0, Math.ceil((Date.parse(iso) - nowMs) / 60000));
}

export function toMatchPlayer(attendee: IAttendee): IMatchPlayer {
  const level = levelDefinitionForXp(attendee.xp ?? 0);

  return {
    id: attendee.id,
    handle: attendee.handle,
    faceSeed: attendee.faceSeed,
    level: level.level,
    levelName: level.name,
    xp: attendee.xp ?? 0,
    banners: attendee.banners ?? [],
    isSpeaker: attendee.isSpeaker,
    topics: attendee.profile?.topics ?? [],
    workingOn: attendee.workingOn ?? '',
    firstTimer: attendee.profile?.firstTimer ?? false,
  };
}

export function placeFor(location: ILocation | undefined, talk?: ITalk): IQuestPlace | undefined {
  if (location) {
    return { locationId: location.id, name: location.name, kind: location.kind, building: location.building, level: location.level };
  }

  if (talk) {
    return { locationId: talk.locationId, name: talk.room, kind: 'room', building: talk.building, level: talk.level };
  }

  return undefined;
}

export function profileQueryText(attendee: IAttendee): string {
  const parts = [attendee.profileText, attendee.workingOn, attendee.headline, (attendee.profile?.topics ?? []).join(', ')];

  return parts
    .filter((part): part is string => typeof part === 'string' && part.trim() !== '')
    .join('. ')
    .slice(0, 2000);
}

export function sharedTopics(mine: string[], theirs: string[]): string[] {
  const lowered = new Set(mine.map((topic) => topic.toLowerCase()));

  return theirs.filter((topic) => lowered.has(topic.toLowerCase()));
}

export function topicsInText(topics: string[], textValue: string): string[] {
  const haystack = textValue.toLowerCase();

  return topics.filter((topic) => haystack.includes(topic.toLowerCase()));
}
