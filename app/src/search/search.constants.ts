export const searchToolNames = ['ask', 'ask_answer'] as const;

export const askResultKinds = ['talk', 'person', 'booth'] as const;

export const summarySources = ['ai_from_abstract'] as const;

export const askSettings = {
  POOL_SIZE: 40,
  PER_GROUP: 6,
  TOP_FOR_ANSWER: 6,
  RANK_WINDOW: 60,
  RANK_CONSTANT: 20,
  SEMANTIC_TIE_BREAKER: 0.2,
  SERVER_TIMEOUT: '5s',
  SNIPPET_CHARS: 260,
  FRAGMENT_CHARS: 220,
  QUERY_MAX_CHARS: 200,
  ANSWER_MIN_CHARS: 40,
  ANSWER_MAX_CHARS: 900,
  SOURCE_TEXT_CHARS: 600,
  AGENT_TIMEOUT_MS: 30_000,
  CACHE_TTL_MS: 30 * 60 * 1000,
  CACHE_MAX_ENTRIES: 200,
} as const;

export const askFallbackAnswer = 'Top matches below.';

export const askLexicalFields = [
  'title^3',
  'speakers^2',
  'abstract',
  'headline^2',
  'profile.topics^2',
  'workingOn',
  'name^3',
  'askAbout^2',
  'description',
  'topics',
  'categories',
];

export const askSemanticFields = [
  { field: 'searchText', boost: 1 },
  { field: 'summary', boost: 1 },
  { field: 'transcript', boost: 0.9 },
  { field: 'profileText', boost: 1 },
];

export const askHighlightFields = ['summary', 'transcript'];

export const askSourceFields = [
  'title',
  'abstract',
  'track',
  'sessionType',
  'speakers',
  'start',
  'end',
  'locationId',
  'building',
  'level',
  'room',
  'isBoss',
  'hasTranscript',
  'summary',
  'summarySource',
  'handle',
  'faceSeed',
  'headline',
  'workingOn',
  'profile.topics',
  'isSpeaker',
  'xp',
  'name',
  'kind',
  'zone',
  'boothNumber',
  'sponsorTier',
  'askAbout',
  'topics',
  'description',
];

export const boothLocationKinds = ['outpost'];

export const askAnswerTemplate = [
  'Answer the attendee question in 3 to 5 short sentences using ONLY the numbered sources below. Do not call any tools.',
  'Cite sources inline with their number in square brackets, like [1] or [2][4]. Every sentence must cite at least one source.',
  'Never invent facts, quotes, times or rooms that are not in the sources. Session summaries marked "AI summary from the abstract" are not transcripts: never present them as what a speaker said.',
  'If the sources do not answer the question, say which sources come closest.',
  'Return JSON shaped exactly like {"answer": "...", "citations": [1, 2]}.',
].join('\n');

export const talkSummaryTemplate = [
  'Write a 320 to 450 word overview of one KubeCon NA 2026 session for attendees deciding whether to go.',
  'Ground it ONLY in the title, abstract, track and speaker names inside <data>. You have not seen the talk and there is no transcript.',
  'Rules: no quotes, no first-person speaker voice, never attribute statements or opinions to the speakers, no invented numbers, products, companies, case studies or results.',
  'Use hedged framing: start with "This session covers", then a paragraph starting "Likely topics include" that expands the abstract into the cloud native concepts it implies, then who it suits, then a paragraph starting "Questions to ask the speakers:" with 3 or 4 questions.',
  'Plain prose, no markdown, no bullet characters, no headings. Do not call any tools.',
  'Return JSON shaped exactly like {"summary": "..."}.',
].join('\n');
