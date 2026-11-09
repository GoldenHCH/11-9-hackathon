import { createHash } from 'node:crypto';
import type { estypes } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { ToolError } from '../tools/tool-errors';
import { IWalkPoint } from '../types/internal.interfaces';
import { IAttendee, ILocation, IQuest, IQuestPlace, ITalk, IXpEvent } from '../types/kubequest.interfaces';
import { QuestType } from '../types/kubequest.types';

const MAX_QUESTS_PER_ATTENDEE = 500;
const MAX_EVENTS_PER_ATTENDEE = 500;

export function questId(attendeeId: string, type: QuestType, targetId: string): string {
  const digest = createHash('sha1').update(`${attendeeId}|${type}|${targetId}`).digest('hex').slice(0, 24);

  return `q_${digest}`;
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'statusCode') === 404;
}

async function getDoc<T>(index: string, id: string): Promise<T | undefined> {
  try {
    const response = await getEsClient().get<T>({ index, id }, esOptions(esTimeouts.DEFAULT_MS));

    return response.found ? response._source : undefined;
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

export async function loadAttendee(attendeeId: string): Promise<IAttendee> {
  const attendee = await getDoc<IAttendee>(indexNames.ATTENDEES, attendeeId);

  if (!attendee) {
    throw new ToolError(404, 'unknown_attendee', 'We could not find that player. Open your personal link again.');
  }

  return attendee;
}

export async function loadTalk(talkId: string): Promise<ITalk | undefined> {
  return getDoc<ITalk>(indexNames.TALKS, talkId);
}

export async function loadLocation(locationId: string | undefined): Promise<ILocation | undefined> {
  return locationId ? getDoc<ILocation>(indexNames.LOCATIONS, locationId) : undefined;
}

export async function loadQuest(id: string): Promise<IQuest | undefined> {
  return getDoc<IQuest>(indexNames.QUESTS, id);
}

export async function listQuests(attendeeId: string): Promise<IQuest[]> {
  const response = await getEsClient().search<IQuest>(
    {
      index: indexNames.QUESTS,
      size: MAX_QUESTS_PER_ATTENDEE,
      query: { term: { attendeeId } },
      sort: [{ offeredAt: { order: 'desc' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.hits.hits.flatMap((hit) => (hit._source ? [hit._source] : []));
}

export async function listEvents(attendeeId: string, since?: Date): Promise<IXpEvent[]> {
  const filter: estypes.QueryDslQueryContainer[] = [{ term: { attendeeId } }];

  if (since) {
    filter.push({ range: { at: { gte: since.toISOString() } } });
  }

  const response = await getEsClient().search<IXpEvent>(
    { index: indexNames.XP_EVENTS, size: MAX_EVENTS_PER_ATTENDEE, query: { bool: { filter } }, sort: [{ at: { order: 'desc' } }] },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.hits.hits.flatMap((hit) => (hit._source ? [hit._source] : []));
}

export async function saveQuests(quests: IQuest[]): Promise<void> {
  if (quests.length === 0) {
    return;
  }

  const operations = quests.flatMap((quest) => [{ index: { _index: indexNames.QUESTS, _id: quest.id } }, quest]);
  const response = await getEsClient().bulk({ operations, refresh: true }, esOptions(esTimeouts.WRITE_MS));

  if (response.errors) {
    throw new ToolError(502, 'datastore_write_failed', 'Saving your quests failed. Try again in a moment.');
  }
}

export async function deleteQuests(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  const operations = ids.map((id) => ({ delete: { _index: indexNames.QUESTS, _id: id } }));
  await getEsClient().bulk({ operations, refresh: true }, esOptions(esTimeouts.WRITE_MS));
}

export function placeOf(location: ILocation): IQuestPlace {
  return { locationId: location.id, name: location.name, kind: location.kind, building: location.building, level: location.level };
}

export function walkPointOf(location: ILocation | undefined): IWalkPoint | undefined {
  return location ? { id: location.id, building: location.building, level: location.level } : undefined;
}

export function talkPlace(talk: ITalk, location?: ILocation): IQuestPlace {
  return location
    ? placeOf(location)
    : { locationId: talk.locationId, name: talk.room, kind: talk.isBoss ? 'boss-room' : 'room', building: talk.building, level: talk.level };
}
