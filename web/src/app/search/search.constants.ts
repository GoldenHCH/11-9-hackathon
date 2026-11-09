export const searchExampleQueries = ['cheaper GPUs', 'OpenTelemetry in production', 'who works on eBPF?', 'platform engineering booths'] as const;

export const searchTabs = [
  { id: 'all', label: 'All' },
  { id: 'talks', label: 'Talks' },
  { id: 'people', label: 'People' },
  { id: 'booths', label: 'Booths' },
] as const;

export const searchSettings = {
  MEET_POLL_MS: 10_000,
  REVEAL_WORD_MS: 35,
  FLASH_MS: 1600,
  ANSWER_ATTEMPTS: 3,
  BOOTH_MAP_LEVEL: 'sp-expo',
  TIME_ZONE: 'America/Denver',
} as const;

export const searchMapLevels: Record<string, string> = {
  'salt palace|level 1': 'sp-l1',
  'salt palace|level 2': 'sp-l2',
  'salt palace|level 3': 'sp-l3',
  'salt palace|solutions showcase': 'sp-expo',
  'hyatt regency|lobby': 'hy-lobby',
  'hyatt regency|level 2': 'hy-l2',
  'hyatt regency|level 3': 'hy-l3',
  'hyatt regency|level 4': 'hy-l4',
  'hyatt regency|level 5': 'hy-l5',
};
