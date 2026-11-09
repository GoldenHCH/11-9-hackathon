import type { estypes } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import { appConfig } from '../config';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { gameRules } from '../types/kubequest.constants';
import { ILeaderboard, ILeaderboardInput, ILeaderboardRow, IPublicPlayer } from '../types/kubequest.interfaces';
import { LeaderboardBoard, LeaderboardPeriod } from '../types/kubequest.types';
import { boardLimits, boardSpanAttributes, connectorEventTypes } from './boards.constants';
import { metricValue, stringField, termsBuckets, topHitSource } from './es-aggs';
import { hiddenPlayerIds, loadVisiblePlayers } from './players';

interface IRankedPlayer {
  attendeeId: string;
  score: number;
}

interface ILatestEvent {
  traceId?: string;
  at?: string;
}

function todayRange(field: string): estypes.QueryDslQueryContainer {
  return { range: { [field]: { gte: 'now/d', time_zone: appConfig.conferenceTimeZone } } };
}

function xpEventFilters(board: LeaderboardBoard, period: LeaderboardPeriod): estypes.QueryDslQueryContainer[] {
  const filters: estypes.QueryDslQueryContainer[] = [];

  if (period === 'today') {
    filters.push(todayRange('at'));
  }

  if (board === 'connectors') {
    filters.push({ terms: { type: connectorEventTypes } });
  }

  return filters;
}

async function rankXpBoard(board: LeaderboardBoard, period: LeaderboardPeriod, hidden: string[]): Promise<IRankedPlayer[]> {
  const response = await getEsClient().search(
    {
      index: indexNames.XP_EVENTS,
      size: 0,
      query: { bool: { filter: xpEventFilters(board, period), must_not: [{ terms: { attendeeId: hidden } }] } },
      aggs: {
        players: {
          terms: { field: 'attendeeId', size: boardLimits.RANKING_BUCKETS, order: [{ score: 'desc' }, { _key: 'asc' }] },
          aggs: { score: { sum: { field: 'xp' } } },
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return termsBuckets(response.aggregations, 'players').map((bucket) => ({ attendeeId: bucket.key, score: metricValue(bucket, 'score') }));
}

async function rankQuestBoard(period: LeaderboardPeriod, hidden: string[]): Promise<IRankedPlayer[]> {
  const filters: estypes.QueryDslQueryContainer[] = [{ term: { status: 'completed' } }];

  if (period === 'today') {
    filters.push(todayRange('completedAt'));
  }

  const response = await getEsClient().search(
    {
      index: indexNames.QUESTS,
      size: 0,
      query: { bool: { filter: filters, must_not: [{ terms: { attendeeId: hidden } }] } },
      aggs: {
        players: {
          terms: { field: 'attendeeId', size: boardLimits.RANKING_BUCKETS, order: [{ _count: 'desc' }, { _key: 'asc' }] },
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return termsBuckets(response.aggregations, 'players').map((bucket) => ({ attendeeId: bucket.key, score: bucket.doc_count }));
}

async function latestEvents(attendeeIds: string[], board: LeaderboardBoard): Promise<Map<string, ILatestEvent>> {
  const latest = new Map<string, ILatestEvent>();

  if (attendeeIds.length === 0) {
    return latest;
  }

  const filters: estypes.QueryDslQueryContainer[] = [{ terms: { attendeeId: attendeeIds } }];

  if (board === 'connectors') {
    filters.push({ terms: { type: connectorEventTypes } });
  }

  const response = await getEsClient().search(
    {
      index: indexNames.XP_EVENTS,
      size: 0,
      query: { bool: { filter: filters } },
      aggs: {
        players: {
          terms: { field: 'attendeeId', size: attendeeIds.length },
          aggs: { latest: { top_hits: { size: 1, sort: [{ at: { order: 'desc' } }], _source: ['traceId', 'at'] } } },
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  for (const bucket of termsBuckets(response.aggregations, 'players')) {
    const source = topHitSource(bucket, 'latest');
    latest.set(bucket.key, { traceId: stringField(source, 'traceId'), at: stringField(source, 'at') });
  }

  return latest;
}

function buildRow(rank: number, player: IPublicPlayer, score: number, latest: ILatestEvent | undefined, myId: string | undefined): ILeaderboardRow {
  return {
    rank,
    player,
    score,
    ...(latest?.traceId ? { latestTraceId: latest.traceId } : {}),
    ...(latest?.at ? { latestEventAt: latest.at } : {}),
    isMe: player.id === myId,
  };
}

export async function computeLeaderboard(input: ILeaderboardInput): Promise<ILeaderboard> {
  const board = input.board ?? 'overall';
  const period = input.period ?? 'today';
  const limit = input.limit ?? gameRules.LEADERBOARD_SIZE;
  const myId = input.attendeeId;
  const hidden = await hiddenPlayerIds();

  const ranked = (board === 'questers' ? await rankQuestBoard(period, hidden) : await rankXpBoard(board, period, hidden)).filter(
    (entry) => entry.score > 0,
  );

  const candidates = ranked.slice(0, limit + 10);
  const myIndex = myId ? ranked.findIndex((entry) => entry.attendeeId === myId) : -1;
  const lookupIds = [...new Set([...candidates.map((entry) => entry.attendeeId), ...(myId ? [myId] : [])])];

  const [players, latest] = await Promise.all([loadVisiblePlayers(lookupIds), latestEvents(lookupIds, board)]);

  const rows: ILeaderboardRow[] = [];

  for (const entry of candidates) {
    const player = players.get(entry.attendeeId);

    if (!player) {
      continue;
    }

    rows.push(buildRow(rows.length + 1, player, entry.score, latest.get(entry.attendeeId), myId));

    if (rows.length >= limit) {
      break;
    }
  }

  const myPlayer = myId ? players.get(myId) : undefined;
  const me =
    rows.find((row) => row.isMe) ??
    (myPlayer
      ? buildRow(myIndex >= 0 ? myIndex + 1 : ranked.length + 1, myPlayer, myIndex >= 0 ? ranked[myIndex].score : 0, latest.get(myPlayer.id), myId)
      : undefined);

  const span = trace.getActiveSpan();
  span?.setAttributes({ [boardSpanAttributes.BOARD]: board, [boardSpanAttributes.PERIOD]: period, [boardSpanAttributes.ROWS]: rows.length });

  if (me) {
    span?.setAttribute(boardSpanAttributes.MY_RANK, me.rank);
  }

  return { board, period, rows, ...(me ? { me } : {}) };
}
