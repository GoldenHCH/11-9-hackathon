export const resourceFiles = {
  SESSIONS: 'sessions.json',
  LOCATIONS: 'locations.json',
  ATTENDEES: 'attendees.seed.json',
  XP_EVENTS: 'xp-events.seed.json',
  INTROS: 'intros.seed.json',
  SEED_META: 'seed-meta.json',
} as const;

export const requiredForIndexing: readonly string[] = [
  resourceFiles.SESSIONS,
  resourceFiles.LOCATIONS,
  resourceFiles.ATTENDEES,
  resourceFiles.XP_EVENTS,
  resourceFiles.INTROS,
];

export const transcriptsDirName = 'transcripts';
