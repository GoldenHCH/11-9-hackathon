export const itineraryRules = {
  MAX_ITEMS: 40,
  MIN_GAP_MINUTES: 30,
  SLOT_MINUTES: 30,
  MAX_SESSIONS: 500,
  MAX_QUERY_LENGTH: 120,
} as const;

export const conferenceDays = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'] as const;

export const defaultConferenceDay = '2026-11-10';

export const scheduleSourceFields = [
  'id',
  'title',
  'speakers',
  'sessionType',
  'track',
  'material',
  'start',
  'end',
  'locationId',
  'building',
  'level',
  'room',
  'isBoss',
];

export const addScript = `
if (ctx._source.itinerary == null) { ctx._source.itinerary = new ArrayList(); }
boolean present = false;
for (def entry : ctx._source.itinerary) { if (entry.talkId == params.talkId) { present = true; } }
if (present || ctx._source.itinerary.size() >= params.maxItems) { ctx.op = 'noop'; }
else { ctx._source.itinerary.add(['talkId': params.talkId, 'addedAt': params.addedAt]); }
`;

export const removeScript = `
if (ctx._source.itinerary == null || !ctx._source.itinerary.removeIf(entry -> entry.talkId == params.talkId)) { ctx.op = 'noop'; }
`;
