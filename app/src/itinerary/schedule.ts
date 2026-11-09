import type { estypes } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { hitSources } from '../match/match-data';
import { logger } from '../observability/logger';
import { IListScheduleInput, ISchedule, IScheduleSession, IScheduleSlot, ITalk } from '../types/kubequest.interfaces';
import { worldNow } from '../world/clock';
import { conferenceDayOf, dayBounds, defaultDayFor, slotEndOf, slotStartOf } from './day.helper';
import { conferenceDays, itineraryRules, scheduleSourceFields } from './itinerary.constants';
import { plannedTalkIds } from './itinerary.store';

type ScheduleTalk = Pick<
  ITalk,
  'id' | 'title' | 'speakers' | 'sessionType' | 'track' | 'material' | 'start' | 'end' | 'locationId' | 'building' | 'level' | 'room' | 'isBoss'
>;

export function toScheduleSession(talk: ScheduleTalk, checkedInCount: number, inItinerary?: boolean): IScheduleSession {
  return {
    id: talk.id,
    title: talk.title,
    speakers: talk.speakers ?? [],
    sessionType: talk.sessionType,
    track: talk.track,
    material: talk.material,
    start: talk.start,
    end: talk.end,
    locationId: talk.locationId,
    building: talk.building,
    level: talk.level,
    room: talk.room,
    isBoss: talk.isBoss ?? false,
    checkedInCount,
    ...(inItinerary === undefined ? {} : { inItinerary }),
  };
}

function bucketsOf(aggregate: estypes.AggregationsAggregate | undefined): estypes.AggregationsStringTermsBucket[] {
  if (!aggregate || !('buckets' in aggregate) || !Array.isArray(aggregate.buckets)) {
    return [];
  }

  return aggregate.buckets as estypes.AggregationsStringTermsBucket[];
}

export async function checkedInCounts(talkIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (talkIds.length === 0) {
    return counts;
  }

  try {
    const response = await getEsClient().search(
      {
        index: indexNames.XP_EVENTS,
        size: 0,
        query: { bool: { filter: [{ term: { type: 'check_in' } }, { terms: { talkId: talkIds } }] } },
        aggs: {
          talks: {
            terms: { field: 'talkId', size: talkIds.length },
            aggs: { players: { cardinality: { field: 'attendeeId' } } },
          },
        },
      },
      esOptions(esTimeouts.SEARCH_MS),
    );

    for (const bucket of bucketsOf(response.aggregations?.['talks'])) {
      const players = bucket['players'] as estypes.AggregationsCardinalityAggregate | undefined;
      counts.set(String(bucket.key), players?.value ?? bucket.doc_count);
    }
  } catch (error) {
    logger.warn({ err: error }, 'schedule check-in counts failed');
  }

  return counts;
}

function textFilter(query: string): estypes.QueryDslQueryContainer {
  const trimmed = query.trim().slice(0, itineraryRules.MAX_QUERY_LENGTH);

  return {
    bool: {
      should: [
        { multi_match: { query: trimmed, fields: ['title^3', 'abstract', 'room'], fuzziness: 'AUTO' } },
        { wildcard: { speakers: { value: `*${trimmed.replace(/[*?\\]/g, '')}*`, case_insensitive: true } } },
        { wildcard: { room: { value: `*${trimmed.replace(/[*?\\]/g, '')}*`, case_insensitive: true } } },
      ],
      minimum_should_match: 1,
    },
  };
}

function postFilter(input: IListScheduleInput): estypes.QueryDslQueryContainer | undefined {
  const filters: estypes.QueryDslQueryContainer[] = [];

  if (input.track) {
    filters.push({ term: { track: input.track } });
  }

  if (input.building) {
    filters.push({ term: { building: input.building } });
  }

  if (input.query && input.query.trim() !== '') {
    filters.push(textFilter(input.query));
  }

  return filters.length > 0 ? { bool: { filter: filters } } : undefined;
}

function groupIntoSlots(sessions: IScheduleSession[]): IScheduleSlot[] {
  const slots = new Map<string, IScheduleSlot>();

  for (const session of sessions) {
    const start = slotStartOf(session.start);
    const slot = slots.get(start) ?? { start, end: slotEndOf(start), sessions: [] };
    slot.sessions.push(session);
    slots.set(start, slot);
  }

  return [...slots.values()].sort((left, right) => Date.parse(left.start) - Date.parse(right.start));
}

async function softPlannedIds(attendeeId: string | undefined): Promise<Set<string> | undefined> {
  if (!attendeeId) {
    return undefined;
  }

  try {
    return await plannedTalkIds(attendeeId);
  } catch (error) {
    logger.warn({ err: error, attendeeId }, 'schedule itinerary lookup failed');

    return undefined;
  }
}

export async function listSchedule(input: IListScheduleInput): Promise<ISchedule> {
  const now = worldNow();
  const day = input.day ?? (input.from ? conferenceDayOf(new Date(input.from)) : defaultDayFor(now));
  const bounds = dayBounds(day);
  const from = input.from ?? bounds.start;
  const to = input.to ?? bounds.end;
  const filter = postFilter(input);

  const [response, planned] = await Promise.all([
    getEsClient().search<ScheduleTalk>(
      {
        index: indexNames.TALKS,
        size: itineraryRules.MAX_SESSIONS,
        _source: scheduleSourceFields,
        query: { bool: { filter: [{ range: { start: { lt: to } } }, { range: { end: { gt: from } } }] } },
        ...(filter ? { post_filter: filter } : {}),
        sort: [{ start: 'asc' }, { room: 'asc' }],
        aggs: { buildings: { terms: { field: 'building', size: 20 } } },
      },
      esOptions(esTimeouts.SEARCH_MS),
    ),
    softPlannedIds(input.attendeeId),
  ]);

  const talks = hitSources(response.hits.hits);
  const counts = await checkedInCounts(talks.map((talk) => talk.id));
  const sessions = talks.map((talk) => toScheduleSession(talk, counts.get(talk.id) ?? 0, planned ? planned.has(talk.id) : undefined));
  const buildings = bucketsOf(response.aggregations?.['buildings']).map((bucket) => String(bucket.key)).sort();

  return {
    day,
    days: [...conferenceDays],
    now: now.toISOString(),
    from,
    to,
    total: sessions.length,
    buildings,
    slots: groupIntoSlots(sessions),
  };
}
