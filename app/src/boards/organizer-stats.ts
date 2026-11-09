import type { estypes } from '@elastic/elasticsearch';
import { appConfig } from '../config';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { bossStateTool } from '../tools/boss-state.tool';
import { gameRules, meetStatuses, questStatuses, xpEventTypes } from '../types/kubequest.constants';
import { IBossState, ILocation, IOrganizerStats, IOrganizerStatsInput, IRoomCount, ITalk } from '../types/kubequest.interfaces';
import { MeetStatus, QuestStatus, XpEventType } from '../types/kubequest.types';
import { boardLimits } from './boards.constants';
import { metricValue, termsBuckets } from './es-aggs';

function sinceRange(field: string, since: string | undefined): estypes.QueryDslQueryContainer {
  return since
    ? { range: { [field]: { gte: since } } }
    : { range: { [field]: { gte: 'now/d', time_zone: appConfig.conferenceTimeZone } } };
}

function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}

async function countPlayers(): Promise<number> {
  const response = await getEsClient().count({ index: indexNames.ATTENDEES }, esOptions(esTimeouts.SEARCH_MS));

  return response.count;
}

async function xpTotals(since: string | undefined): Promise<Pick<IOrganizerStats, 'checkInsToday' | 'xpToday' | 'xpByType'>> {
  const response = await getEsClient().search(
    {
      index: indexNames.XP_EVENTS,
      size: 0,
      query: { bool: { filter: [sinceRange('at', since)] } },
      aggs: {
        total: { sum: { field: 'xp' } },
        types: { terms: { field: 'type', size: xpEventTypes.length }, aggs: { xp: { sum: { field: 'xp' } } } },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const xpByType: Partial<Record<XpEventType, number>> = {};
  let checkInsToday = 0;

  for (const bucket of termsBuckets(response.aggregations, 'types')) {
    if (isOneOf(xpEventTypes, bucket.key)) {
      xpByType[bucket.key] = metricValue(bucket, 'xp');
    }

    if (bucket.key === 'check_in') {
      checkInsToday = bucket.doc_count;
    }
  }

  return { checkInsToday, xpToday: metricValue(response.aggregations, 'total'), xpByType };
}

async function meetFunnel(since: string | undefined): Promise<Partial<Record<MeetStatus, number>>> {
  const response = await getEsClient().search(
    {
      index: indexNames.INTROS,
      size: 0,
      query: { bool: { filter: [sinceRange('proposedAt', since)] } },
      aggs: { statuses: { terms: { field: 'status', size: meetStatuses.length } } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const raw: Partial<Record<MeetStatus, number>> = {};

  for (const bucket of termsBuckets(response.aggregations, 'statuses')) {
    if (isOneOf(meetStatuses, bucket.key)) {
      raw[bucket.key] = bucket.doc_count;
    }
  }

  const met = raw.met ?? 0;
  const accepted = (raw.accepted ?? 0) + met;
  const proposed = Object.values(raw).reduce((sum, count) => sum + count, 0);

  return { ...raw, proposed, accepted, met };
}

async function questCounts(since: string | undefined): Promise<Partial<Record<QuestStatus, number>>> {
  const response = await getEsClient().search(
    {
      index: indexNames.QUESTS,
      size: 0,
      query: { bool: { filter: [sinceRange('offeredAt', since)] } },
      aggs: { statuses: { terms: { field: 'status', size: questStatuses.length } } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const counts: Partial<Record<QuestStatus, number>> = {};

  for (const bucket of termsBuckets(response.aggregations, 'statuses')) {
    if (isOneOf(questStatuses, bucket.key)) {
      counts[bucket.key] = bucket.doc_count;
    }
  }

  return counts;
}

async function loadLocations(ids: string[]): Promise<Map<string, ILocation>> {
  const locations = new Map<string, ILocation>();

  if (ids.length === 0) {
    return locations;
  }

  const response = await getEsClient().search<ILocation>(
    {
      index: indexNames.LOCATIONS,
      size: ids.length,
      _source: { excludes: ['searchText'] },
      query: { terms: { id: ids } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  for (const hit of response.hits.hits) {
    if (hit._source?.id) {
      locations.set(hit._source.id, hit._source);
    }
  }

  return locations;
}

export async function roomBusyness(size: number = boardLimits.BUSIEST_ROOMS): Promise<IRoomCount[]> {
  const response = await getEsClient().search(
    {
      index: indexNames.XP_EVENTS,
      size: 0,
      query: {
        bool: {
          filter: [{ term: { type: 'check_in' } }, { range: { at: { gte: `now-${gameRules.BUSYNESS_WINDOW_MINUTES}m` } } }],
        },
      },
      aggs: {
        rooms: {
          terms: { field: 'locationId', size, order: [{ people: 'desc' }, { _key: 'asc' }] },
          aggs: { people: { cardinality: { field: 'attendeeId' } } },
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const counts = termsBuckets(response.aggregations, 'rooms').map((bucket) => ({ locationId: bucket.key, count: metricValue(bucket, 'people') }));
  const locations = await loadLocations(counts.map((entry) => entry.locationId));

  return counts.flatMap((entry) => {
    const location = locations.get(entry.locationId);

    return location ? [{ location, count: entry.count }] : [];
  });
}

async function liveBosses(): Promise<IBossState[]> {
  const response = await getEsClient().search<Pick<ITalk, 'id'>>(
    {
      index: indexNames.TALKS,
      size: boardLimits.LIVE_BOSSES,
      _source: ['id'],
      query: {
        bool: {
          filter: [
            { term: { isBoss: true } },
            { range: { start: { lte: 'now' } } },
            { range: { end: { gte: `now-${gameRules.BOSS_GRACE_MINUTES}m` } } },
          ],
        },
      },
      sort: [{ start: { order: 'asc' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const talkIds = response.hits.hits.flatMap((hit) => (hit._source?.id ? [hit._source.id] : []));
  const states = await Promise.all(
    talkIds.map(async (talkId) => {
      try {
        return await bossStateTool.execute({ talkId });
      } catch (error) {
        logger.warn({ talkId, err: error }, 'boss state unavailable for organizer stats');

        return undefined;
      }
    }),
  );

  return states.filter((state): state is IBossState => state !== undefined);
}

async function settle<T>(label: string, work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch (error) {
    logger.warn({ section: label, err: error }, 'organizer stats section failed');

    return fallback;
  }
}

export async function computeOrganizerStats(input: IOrganizerStatsInput): Promise<IOrganizerStats> {
  const since = input.since;

  const [players, totals, meets, quests, busiestRooms, bosses] = await Promise.all([
    countPlayers(),
    xpTotals(since),
    settle('meets', meetFunnel(since), {}),
    settle('quests', questCounts(since), {}),
    settle('rooms', roomBusyness(), []),
    settle('bosses', liveBosses(), []),
  ]);

  return { players, ...totals, meets, quests, busiestRooms, bosses, generatedAt: new Date().toISOString() };
}
