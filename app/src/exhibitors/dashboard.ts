import { metricValue } from '../boards/es-aggs';
import { appConfig } from '../config';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { adminAccessScope, exhibitorAccessScope, verifyAccessKey } from '../security/tokens';
import { ToolError } from '../tools/tool-errors';
import { questStatuses } from '../types/kubequest.constants';
import {
  IExhibitorDashboard,
  IExhibitorDashboardInput,
  IExhibitorRank,
  IExhibitorVisitor,
  IExhibitorVisits,
  IFacetCount,
  IHourCount,
  IPublicPlayer,
  IXpEvent,
} from '../types/kubequest.interfaces';
import { QuestStatus } from '../types/kubequest.types';
import { exhibitorMessages, exhibitorSettings } from './exhibitors.constants';
import { IVisitorProfile, IVisitorRow } from './exhibitors.interfaces';
import { loadOutposts, outpostScanUrl, publicPageUrl, requireOutpost, toExhibitorDetail } from './outposts';
import {
  boothStats,
  docCount,
  histogramBuckets,
  isShownPublicly,
  loadVisitors,
  nowRange,
  questStatusesByBooth,
  settle,
  subAggregation,
  termKeys,
  todayRange,
  visitFilter,
} from './visits';

interface IBoothActivity {
  visits: Omit<IExhibitorVisits, 'firstTimersToday'>;
  byHour: IHourCount[];
  recent: IVisitorRow[];
  visitorIds: string[];
  todayIds: string[];
  hereIds: string[];
}

function isQuestStatus(value: string): value is QuestStatus {
  return (questStatuses as readonly string[]).includes(value);
}

function totalHits(total: number | { value: number } | undefined): number {
  if (total === undefined) {
    return 0;
  }

  return typeof total === 'number' ? total : total.value;
}

async function boothActivity(outpostId: string): Promise<IBoothActivity> {
  const response = await getEsClient().search<Pick<IXpEvent, 'attendeeId' | 'at'>>(
    {
      index: indexNames.XP_EVENTS,
      size: exhibitorSettings.RECENT_VISITORS,
      track_total_hits: true,
      _source: ['attendeeId', 'at'],
      query: { bool: { filter: visitFilter([outpostId]) } },
      collapse: { field: 'attendeeId' },
      sort: [{ at: { order: 'desc' } }],
      aggs: {
        people: { cardinality: { field: 'attendeeId' } },
        visitors: { terms: { field: 'attendeeId', size: exhibitorSettings.MAX_VISITORS } },
        now: {
          filter: nowRange(),
          aggs: {
            people: { cardinality: { field: 'attendeeId' } },
            visitors: { terms: { field: 'attendeeId', size: exhibitorSettings.HERE_NOW * 4, order: { last: 'desc' } }, aggs: { last: { max: { field: 'at' } } } },
          },
        },
        today: {
          filter: todayRange(),
          aggs: {
            people: { cardinality: { field: 'attendeeId' } },
            visitors: { terms: { field: 'attendeeId', size: exhibitorSettings.MAX_VISITORS } },
            byHour: { date_histogram: { field: 'at', fixed_interval: '1h', time_zone: appConfig.conferenceTimeZone, min_doc_count: 0 } },
          },
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const aggregations = response.aggregations;
  const now = subAggregation(aggregations, 'now');
  const today = subAggregation(aggregations, 'today');
  const recent = response.hits.hits.flatMap((hit) =>
    hit._source?.attendeeId && hit._source.at ? [{ attendeeId: hit._source.attendeeId, at: hit._source.at }] : [],
  );

  return {
    visits: {
      now: metricValue(now, 'people'),
      today: docCount(today),
      uniqueToday: metricValue(today, 'people'),
      conference: totalHits(response.hits.total),
      uniqueConference: metricValue(aggregations, 'people'),
    },
    byHour: histogramBuckets(today, 'byHour').map((bucket) => ({ hour: new Date(bucket.key).toISOString(), visits: bucket.doc_count })),
    recent,
    visitorIds: termKeys(aggregations, 'visitors'),
    todayIds: termKeys(today, 'visitors'),
    hereIds: termKeys(now, 'visitors'),
  };
}

function topFacets(values: string[]): IFacetCount[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => right.count - left.count || left.value.localeCompare(right.value))
    .slice(0, exhibitorSettings.TOP_VISITOR_FACETS);
}

function profilesFor(ids: string[], visitors: Map<string, IVisitorProfile>): IVisitorProfile[] {
  return ids.flatMap((id) => {
    const visitor = visitors.get(id);

    return visitor ? [visitor] : [];
  });
}

async function boothRank(outpostId: string): Promise<IExhibitorRank | null> {
  const outposts = await loadOutposts();
  const stats = await boothStats(outposts.map((outpost) => outpost.id));
  const mine = stats.byBooth.get(outpostId);

  if (!mine || mine.visits === 0) {
    return null;
  }

  const visitedBooths = [...stats.byBooth.values()].filter((counts) => counts.visits > 0);
  const ahead = visitedBooths.filter((counts) => counts.unique > mine.unique).length;

  return { position: ahead + 1, of: visitedBooths.length };
}

async function boothQuests(outpostId: string): Promise<Partial<Record<QuestStatus, number>>> {
  const byBooth = await questStatusesByBooth([outpostId]);
  const quests: Partial<Record<QuestStatus, number>> = {};

  for (const [status, count] of byBooth.get(outpostId) ?? new Map<string, number>()) {
    if (isQuestStatus(status)) {
      quests[status] = count;
    }
  }

  return quests;
}

export function assertExhibitorKey(outpostId: string, key: string): void {
  const allowed = verifyAccessKey(exhibitorAccessScope(outpostId), key) || verifyAccessKey(adminAccessScope(), key);

  if (!allowed) {
    throw new ToolError(403, 'bad_key', exhibitorMessages.BAD_EXHIBITOR_KEY);
  }
}

export async function exhibitorDashboard(input: IExhibitorDashboardInput): Promise<IExhibitorDashboard> {
  assertExhibitorKey(input.outpostId, input.key);

  const outpost = await requireOutpost(input.outpostId);
  const [activity, quests, rank] = await Promise.all([
    boothActivity(outpost.id),
    settle('dashboard.quests', boothQuests(outpost.id), {}),
    settle('dashboard.rank', boothRank(outpost.id), null),
  ]);

  const visitors = await settle('dashboard.visitors', loadVisitors(activity.visitorIds), new Map<string, IVisitorProfile>());
  const everyone = profilesFor(activity.visitorIds, visitors);
  const todays = profilesFor(activity.todayIds, visitors);
  const recentVisitors: IExhibitorVisitor[] = activity.recent.flatMap((row) => {
    const visitor = visitors.get(row.attendeeId);

    return visitor && isShownPublicly(visitor.attendee)
      ? [{ player: visitor.player, at: row.at, firstTimer: visitor.attendee.profile?.firstTimer === true }]
      : [];
  });
  const hereNow: IPublicPlayer[] = profilesFor(activity.hereIds, visitors)
    .filter((visitor) => isShownPublicly(visitor.attendee))
    .slice(0, exhibitorSettings.HERE_NOW)
    .map((visitor) => visitor.player);

  return {
    exhibitor: toExhibitorDetail(outpost, activity.visits.now),
    scanUrl: outpostScanUrl(outpost.id),
    publicPageUrl: publicPageUrl(outpost.id),
    visits: { ...activity.visits, firstTimersToday: todays.filter((visitor) => visitor.attendee.profile?.firstTimer === true).length },
    byHour: activity.byHour,
    visitorTopics: topFacets(everyone.flatMap((visitor) => visitor.attendee.profile?.topics ?? [])),
    visitorLevels: topFacets(everyone.map((visitor) => visitor.player.levelName)),
    recentVisitors,
    hereNow,
    quests,
    rank,
    generatedAt: new Date().toISOString(),
  };
}
