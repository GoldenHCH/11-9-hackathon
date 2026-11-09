import type { estypes } from '@elastic/elasticsearch';
import { metricValue, termsBuckets } from '../boards/es-aggs';
import { appConfig } from '../config';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { publicPlayer } from '../profile/public-id';
import { gameRules } from '../types/kubequest.constants';
import { IAttendee, IPublicPlayer, IXpEvent } from '../types/kubequest.interfaces';
import { levelDefinitionForXp } from '../xp/levels';
import { exhibitorSettings, visitEventTypes } from './exhibitors.constants';
import { IBoothCounts, IBoothStats, IHistogramBucket, IVisitorProfile } from './exhibitors.interfaces';

type QueryContainer = estypes.QueryDslQueryContainer;

const visitorSourceFields = ['id', 'handle', 'faceSeed', 'xp', 'level', 'banners', 'isSpeaker', 'profile', 'settings', 'visible', 'blockedIds'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function nowRange(): QueryContainer {
  return { range: { at: { gte: `now-${gameRules.BUSYNESS_WINDOW_MINUTES}m` } } };
}

export function todayRange(since?: string): QueryContainer {
  return since ? { range: { at: { gte: since } } } : { range: { at: { gte: 'now/d', time_zone: appConfig.conferenceTimeZone } } };
}

export function visitFilter(locationIds: string[]): QueryContainer[] {
  return [{ terms: { type: visitEventTypes } }, { terms: { locationId: locationIds } }];
}

export function subAggregation(container: unknown, name: string): unknown {
  return isRecord(container) ? container[name] : undefined;
}

export function docCount(container: unknown): number {
  return isRecord(container) && typeof container.doc_count === 'number' ? container.doc_count : 0;
}

export function histogramBuckets(aggregations: unknown, name: string): IHistogramBucket[] {
  const aggregation = subAggregation(aggregations, name);

  if (!isRecord(aggregation) || !Array.isArray(aggregation.buckets)) {
    return [];
  }

  return aggregation.buckets.filter(
    (bucket): bucket is IHistogramBucket => isRecord(bucket) && typeof bucket.key === 'number' && typeof bucket.doc_count === 'number',
  );
}

export function termKeys(container: unknown, name: string): string[] {
  return termsBuckets(container, name).map((bucket) => bucket.key);
}

export function safeErrorFields(error: unknown): Record<string, string | number> {
  const meta: unknown = isRecord(error) ? error.meta : undefined;
  const statusCode = isRecord(meta) && typeof meta.statusCode === 'number' ? meta.statusCode : undefined;

  return {
    error: error instanceof Error ? error.name : 'unknown',
    ...(statusCode !== undefined ? { status: statusCode } : {}),
  };
}

export async function settle<T>(label: string, work: Promise<T>, fallback: T): Promise<T> {
  try {
    return await work;
  } catch (error) {
    logger.warn({ section: label, ...safeErrorFields(error) }, 'exhibitor section failed');

    return fallback;
  }
}

export async function visitorsNowByBooth(locationIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  if (locationIds.length === 0) {
    return counts;
  }

  const response = await getEsClient().search(
    {
      index: indexNames.XP_EVENTS,
      size: 0,
      query: { bool: { filter: [...visitFilter(locationIds), nowRange()] } },
      aggs: {
        booths: {
          terms: { field: 'locationId', size: locationIds.length },
          aggs: { people: { cardinality: { field: 'attendeeId' } } },
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  for (const bucket of termsBuckets(response.aggregations, 'booths')) {
    counts.set(bucket.key, metricValue(bucket, 'people'));
  }

  return counts;
}

export async function boothsVisitedBy(attendeeId: string): Promise<Set<string>> {
  const response = await getEsClient().search(
    {
      index: indexNames.XP_EVENTS,
      size: 0,
      query: { bool: { filter: [{ term: { attendeeId } }, { terms: { type: visitEventTypes } }] } },
      aggs: { booths: { terms: { field: 'locationId', size: exhibitorSettings.MAX_OUTPOSTS } } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return new Set(termKeys(response.aggregations, 'booths'));
}

export async function lastVisitBy(attendeeId: string, outpostId: string): Promise<string | undefined> {
  const response = await getEsClient().search<Pick<IXpEvent, 'at'>>(
    {
      index: indexNames.XP_EVENTS,
      size: 1,
      _source: ['at'],
      query: { bool: { filter: [{ term: { attendeeId } }, { term: { locationId: outpostId } }, { terms: { type: visitEventTypes } }] } },
      sort: [{ at: { order: 'desc' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.hits.hits[0]?._source?.at;
}

export async function boothStats(locationIds: string[], since?: string): Promise<IBoothStats> {
  const byBooth = new Map<string, IBoothCounts>();

  if (locationIds.length === 0) {
    return { byBooth, visits: 0, unique: 0 };
  }

  const boothAggregation: estypes.AggregationsAggregationContainer = {
    terms: { field: 'locationId', size: locationIds.length },
    aggs: { people: { cardinality: { field: 'attendeeId' } } },
  };

  const response = await getEsClient().search(
    {
      index: indexNames.XP_EVENTS,
      size: 0,
      query: { bool: { filter: visitFilter(locationIds) } },
      aggs: {
        today: { filter: todayRange(since), aggs: { people: { cardinality: { field: 'attendeeId' } }, booths: boothAggregation } },
        now: { filter: nowRange(), aggs: { booths: boothAggregation } },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const today = subAggregation(response.aggregations, 'today');
  const now = subAggregation(response.aggregations, 'now');

  for (const bucket of termsBuckets(today, 'booths')) {
    byBooth.set(bucket.key, { visits: bucket.doc_count, unique: metricValue(bucket, 'people'), now: 0 });
  }

  for (const bucket of termsBuckets(now, 'booths')) {
    const counts = byBooth.get(bucket.key) ?? { visits: 0, unique: 0, now: 0 };
    byBooth.set(bucket.key, { ...counts, now: metricValue(bucket, 'people') });
  }

  return { byBooth, visits: docCount(today), unique: metricValue(today, 'people') };
}

export async function questStatusesByBooth(locationIds: string[], status?: string): Promise<Map<string, Map<string, number>>> {
  const counts = new Map<string, Map<string, number>>();

  if (locationIds.length === 0) {
    return counts;
  }

  const filter: QueryContainer[] = [{ term: { type: 'outpost' } }, { terms: { locationId: locationIds } }];

  if (status) {
    filter.push({ term: { status } });
  }

  const response = await getEsClient().search(
    {
      index: indexNames.QUESTS,
      size: 0,
      query: { bool: { filter } },
      aggs: {
        booths: {
          terms: { field: 'locationId', size: locationIds.length },
          aggs: { statuses: { terms: { field: 'status', size: 10 } } },
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  for (const bucket of termsBuckets(response.aggregations, 'booths')) {
    counts.set(bucket.key, new Map(termsBuckets(bucket, 'statuses').map((statusBucket) => [statusBucket.key, statusBucket.doc_count])));
  }

  return counts;
}

export function toPublicPlayer(attendee: IAttendee): IPublicPlayer {
  const xp = attendee.xp ?? 0;
  const definition = levelDefinitionForXp(xp);

  return publicPlayer({
    id: attendee.id,
    handle: attendee.handle,
    faceSeed: attendee.faceSeed ?? attendee.handle,
    level: attendee.level ?? definition.level,
    levelName: definition.name,
    xp,
    banners: attendee.banners ?? [],
    ...(attendee.isSpeaker ? { isSpeaker: true } : {}),
  });
}

export function isShownPublicly(attendee: IAttendee): boolean {
  return attendee.visible !== false && attendee.settings?.meetingOn === true && attendee.settings?.hideFromLeaderboard !== true;
}

export async function loadVisitors(attendeeIds: string[]): Promise<Map<string, IVisitorProfile>> {
  const unique = [...new Set(attendeeIds.filter((id) => id !== ''))].slice(0, exhibitorSettings.MAX_VISITORS);
  const visitors = new Map<string, IVisitorProfile>();

  if (unique.length === 0) {
    return visitors;
  }

  const response = await getEsClient().mget<IAttendee>(
    { index: indexNames.ATTENDEES, ids: unique, _source_includes: visitorSourceFields },
    esOptions(esTimeouts.SEARCH_MS),
  );

  for (const doc of response.docs) {
    if ('found' in doc && doc.found && doc._source) {
      const attendee: IAttendee = { ...doc._source, id: doc._id };
      visitors.set(doc._id, { attendee, player: toPublicPlayer(attendee) });
    }
  }

  return visitors;
}
