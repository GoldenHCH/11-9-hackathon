import { XpEventType } from '../types/kubequest.types';

export const connectorEventTypes: XpEventType[] = ['handshake', 'welcome'];

export const boardLimits = {
  RANKING_BUCKETS: 5000,
  HIDDEN_PLAYERS: 5000,
  BUSIEST_ROOMS: 8,
  LIVE_BOSSES: 5,
} as const;

export const boardSpanAttributes = {
  BOARD: 'kubequest.leaderboard.board',
  PERIOD: 'kubequest.leaderboard.period',
  ROWS: 'kubequest.leaderboard.rows',
  MY_RANK: 'kubequest.leaderboard.my_rank',
} as const;
