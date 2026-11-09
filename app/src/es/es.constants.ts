export const indexNames = {
  TALKS: 'talks',
  ATTENDEES: 'attendees',
  LOCATIONS: 'locations',
  XP_EVENTS: 'xp_events',
  INTROS: 'intros',
  QUESTS: 'quests',
} as const;

export const esTimeouts = {
  DEFAULT_MS: 5000,
  SEARCH_MS: 8000,
  WRITE_MS: 5000,
  HEALTH_MS: 2000,
  ADMIN_MS: 15000,
  INFERENCE_MS: 20000,
} as const;
