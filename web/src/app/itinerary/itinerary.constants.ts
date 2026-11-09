export const conferenceTimeZone = 'America/Denver';

export const conferenceDayOptions = [
  { day: '2026-11-09', label: 'Mon', date: '9' },
  { day: '2026-11-10', label: 'Tue', date: '10' },
  { day: '2026-11-11', label: 'Wed', date: '11' },
  { day: '2026-11-12', label: 'Thu', date: '12' },
] as const;

export const fallbackConferenceDay = '2026-11-10';

export const trackOptions = [
  { id: 'ai', label: 'AI Inference + Agentic' },
  { id: 'platform', label: 'Platform Engineering' },
  { id: 'operations', label: 'Operations + Performance' },
  { id: 'data', label: 'Data Processing + Storage' },
  { id: 'security', label: 'Security' },
  { id: 'connectivity', label: 'Connectivity' },
  { id: 'inclusion', label: 'Inclusion + Accessibility' },
  { id: 'other', label: 'Everything else' },
] as const;

export const itineraryTimings = {
  NOW_WINDOW_MINUTES: 90,
  CLOCK_TICK_MS: 60000,
  SEARCH_DEBOUNCE_MS: 300,
} as const;
