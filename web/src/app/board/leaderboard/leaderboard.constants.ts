import { LeaderboardBoard, LeaderboardPeriod } from './leaderboard.types';

export const leaderboardRefreshMs = 15000;
export const leaderboardMaxBackoffMs = 60000;
export const leaderboardLimit = 20;
export const rankChangeHighlightMs = 1600;
export const defaultTraceUrlTemplate = 'https://app.dash0.com/goto/traces?trace_id={traceId}';

export const leaderboardBoards: { id: LeaderboardBoard; label: string; scoreUnit: string }[] = [
  { id: 'overall', label: 'Overall', scoreUnit: 'XP' },
  { id: 'connectors', label: 'Connectors', scoreUnit: 'XP' },
  { id: 'questers', label: 'Questers', scoreUnit: 'quests' },
];

export const leaderboardPeriods: { id: LeaderboardPeriod; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'conference', label: 'All conference' },
];

export const bannerIcons: Record<string, { icon: string; label: string }> = {
  'observability-nerd': { icon: 'visibility', label: 'Observability Nerd banner' },
  connector: { icon: 'hub', label: 'Connector banner' },
  welcomer: { icon: 'waving_hand', label: 'Welcomer banner' },
  explorer: { icon: 'explore', label: 'Explorer banner' },
  scout: { icon: 'travel_explore', label: 'Scout banner' },
  speaker: { icon: 'mic', label: 'Speaker banner' },
};
