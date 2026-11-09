export const indexNames = {
  TALKS: 'talks',
  ATTENDEES: 'attendees',
  LOCATIONS: 'locations',
  XP_EVENTS: 'xp_events',
  INTROS: 'intros',
} as const;

export const allIndexNames = [
  indexNames.TALKS,
  indexNames.ATTENDEES,
  indexNames.LOCATIONS,
  indexNames.XP_EVENTS,
  indexNames.INTROS,
] as const;

export const esTimeouts = {
  HEALTH_MS: 1000,
  BULK_MS: 120000,
} as const;

export const healthCacheMs = 10000;
