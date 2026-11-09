export const exhibitorSettings = {
  DEFAULT_LIMIT: 60,
  MAX_LIMIT: 400,
  MAX_OFFSET: 10000,
  QUERY_MAX_LENGTH: 200,
  QUERY_WINDOW: 96,
  RANK_CONSTANT: 20,
  SERVER_TIMEOUT: '6s',
  OUTPOST_CACHE_MS: 60_000,
  TALK_CACHE_MS: 300_000,
  MAX_OUTPOSTS: 1000,
  MAX_TALKS_SCANNED: 2000,
  MAX_TALKS: 6,
  MAX_PLAYERS_HERE: 6,
  NEARBY: 4,
  RECENT_VISITORS: 20,
  HERE_NOW: 12,
  MAX_VISITORS: 1000,
  TOP_VISITOR_FACETS: 10,
  MIN_COMPANY_MATCH_LENGTH: 4,
} as const;

export const visitEventTypes = ['outpost', 'check_in'];

export const expoMapUrl = 'https://events.linuxfoundation.org/wp-content/uploads/2026/11/KCNA26-ExpoHallMap_Digital.pdf';

export const exhibitorMessages = {
  UNKNOWN_OUTPOST: 'We could not find that booth. Check the booth list and try again.',
  BAD_EXHIBITOR_KEY: "That link doesn't open this booth's dashboard. Ask the organizers for your booth's staff link.",
  BAD_ADMIN_KEY: "That link doesn't open the organizer view.",
} as const;

export const defaultTiers = {
  SPONSOR: 'Exhibitor',
  PROJECT: 'Project',
} as const;

export const unassignedZone = 'Unassigned';
