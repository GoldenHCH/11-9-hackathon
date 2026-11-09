export const materials = ['circuit', 'stone', 'glass', 'crate', 'iron', 'copper', 'lantern', 'wood', 'gold'] as const;

export const tracks = ['ai', 'platform', 'operations', 'data', 'security', 'connectivity', 'inclusion', 'other'] as const;

export const trackCatalog = {
  ai: { label: 'AI Inference + Agentic', material: 'circuit' },
  platform: { label: 'Platform Engineering', material: 'stone' },
  operations: { label: 'Operations + Performance', material: 'glass' },
  data: { label: 'Data Processing + Storage', material: 'crate' },
  security: { label: 'Security', material: 'iron' },
  connectivity: { label: 'Connectivity', material: 'copper' },
  inclusion: { label: 'Inclusion + Accessibility', material: 'lantern' },
  other: { label: 'Everything else', material: 'wood' },
} as const;

export const materialCatalog = {
  circuit: { label: 'Circuit', color: '#2fb3a6', pattern: 'circuit' },
  stone: { label: 'Stone', color: '#8a8f98', pattern: 'bricks' },
  glass: { label: 'Glass', color: '#7cc8f2', pattern: 'panes' },
  crate: { label: 'Crate', color: '#b5793b', pattern: 'planks-cross' },
  iron: { label: 'Iron', color: '#c9ced6', pattern: 'rivets' },
  copper: { label: 'Copper', color: '#d0773f', pattern: 'diagonal' },
  lantern: { label: 'Lantern', color: '#f2c14e', pattern: 'glow' },
  wood: { label: 'Wood', color: '#9c6b3f', pattern: 'grain' },
  gold: { label: 'Gold', color: '#f5d142', pattern: 'shine' },
} as const;

export const locationKinds = ['room', 'outpost', 'theater', 'campfire', 'boss-room'] as const;

export const sessionTypes = ['keynote', 'breakout', 'lightning', 'tutorial', 'panel', 'other'] as const;

export const xpEventTypes = ['check_in', 'quiz', 'handshake', 'welcome', 'outpost', 'boss', 'badge'] as const;

export const handshakeStatuses = ['waiting', 'matched', 'mismatched', 'expired'] as const;

export const handshakeRoles = ['asker', 'answerer'] as const;

export const handshakeQuestionSources = ['shared_topic', 'booth_note', 'talk', 'working_on', 'fallback'] as const;

export const questTypes = ['attend', 'quiz', 'chat', 'outpost', 'collection', 'boss'] as const;

export const questStatuses = ['offered', 'accepted', 'not_now', 'declined', 'dropped', 'completed', 'expired'] as const;

export const questResponses = ['accept', 'not_now', 'not_for_me', 'drop'] as const;

export const questSources = ['board', 'player'] as const;

export const questTargetKinds = ['session', 'outpost'] as const;

export const declineReasons = ['not_my_topic', 'too_far', 'no_time'] as const;

export const meetStatuses = ['proposed', 'accepted', 'met', 'declined', 'cancelled', 'expired'] as const;

export const meetResponses = ['accept', 'decline', 'cant_make_it'] as const;

export const meetRoles = ['proposer', 'partner'] as const;

export const leaderboardBoards = ['overall', 'connectors', 'questers'] as const;

export const leaderboardPeriods = ['today', 'conference'] as const;

export const checkInStatuses = ['awarded', 'repeat', 'rejected'] as const;

export const checkInRejections = [
  'missing_token',
  'bad_signature',
  'expired_token',
  'unknown_location',
  'unknown_attendee',
  'outside_session',
  'daily_cap',
  'wrong_building',
] as const;

export const searchResultKinds = ['session', 'player', 'outpost', 'room', 'campfire'] as const;

export const itineraryItemKinds = ['talk', 'meet', 'quest', 'gap'] as const;

export const bossStatuses = ['waiting', 'fighting', 'defeated', 'escaped'] as const;

export const quizSources = ['transcript', 'abstract'] as const;

export const aiProviders = ['agent_builder', 'inference', 'fallback'] as const;

export const aiPurposes = ['quiz', 'icebreaker', 'chat_prompt', 'match_reason', 'profile_topics', 'quest_reason'] as const;

export const bannerIds = ['observability-nerd', 'connector', 'welcomer', 'explorer', 'scout', 'speaker'] as const;

export const bannerCatalog = {
  'observability-nerd': { name: 'Observability Nerd', description: 'Collect 3 glass blocks from Operations + Performance talks', target: 3 },
  connector: { name: 'Connector', description: 'Complete 3 meets', target: 3 },
  welcomer: { name: 'Welcomer', description: 'Complete 2 meets with first-timers', target: 2 },
  explorer: { name: 'Explorer', description: 'Check in at both buildings', target: 2 },
  scout: { name: 'Scout', description: 'Visit 5 outposts in a day', target: 5 },
  speaker: { name: 'Speaker', description: 'Speaking at KubeCon', target: 1 },
} as const;

export const playerLevels = [
  { level: 1, name: 'Pod', minXp: 0 },
  { level: 2, name: 'Deployment', minXp: 50 },
  { level: 3, name: 'Node', minXp: 200 },
  { level: 4, name: 'Cluster', minXp: 450 },
  { level: 5, name: 'Control Plane', minXp: 800 },
] as const;

export const xpRewards = {
  CHECK_IN: 10,
  QUIZ_CORRECT_ANSWER: 5,
  MEET: 50,
  MEET_FIRST_TIMER_BONUS: 25,
  OUTPOST: 10,
  BOSS_CORRECT_ANSWER: 5,
  BOSS_DEFEATED_BONUS: 25,
} as const;

export const gameRules = {
  MAX_OFFERS: 3,
  MAX_ACTIVE_QUESTS: 3,
  MAX_TOPICS: 5,
  NOT_NOW_MINUTES: 30,
  ATTEND_OFFER_WINDOW_MINUTES: 90,
  MEET_OFFER_MINUTES: 20,
  MEET_SCAN_WINDOW_MINUTES: 30,
  CHECK_IN_COOLDOWN_MINUTES: 60,
  SESSION_GRACE_MINUTES: 10,
  OUTPOSTS_PER_DAY: 5,
  SCREEN_TOKEN_MINUTES: 10,
  BUSYNESS_WINDOW_MINUTES: 20,
  BOSS_HEALTH_PER_PLAYER: 3,
  BOSS_GRACE_MINUTES: 15,
  BOSS_QUESTIONS: 5,
  QUIZ_QUESTIONS: 3,
  LEADERBOARD_SIZE: 20,
  HANDSHAKE_CODE_SECONDS: 60,
  HANDSHAKE_ANSWER_MINUTES: 5,
  HANDSHAKE_ASKER_ATTEMPTS: 2,
  HANDSHAKE_XP_PER_HOUR: 6,
  BOOTH_NOTE_MIN_CHARS: 20,
  BOOTH_NOTE_MAX_CHARS: 1000,
  BOOTH_XP_GAP_MINUTES: 3,
  MESSAGE_MAX_CHARS: 500,
  MESSAGES_PER_TEN_MINUTES: 20,
} as const;

export const walkTimes = {
  SAME_ROOM: 0,
  SAME_LEVEL: 2,
  OTHER_LEVEL: 4,
  OTHER_BUILDING: 8,
} as const;

export const matchSignalWords = {
  FIRST: ['COPPER', 'IRON', 'GLASS', 'STONE', 'LANTERN', 'CIRCUIT', 'CRATE', 'GOLD', 'CEDAR', 'COBALT'],
  SECOND: ['FOX', 'OWL', 'OTTER', 'LYNX', 'HERON', 'BISON', 'MARMOT', 'BADGER', 'FALCON', 'MOOSE'],
} as const;

export const toolNames = [
  'sign_up',
  'get_profile',
  'update_settings',
  'check_in',
  'screen_token',
  'whats_around_me',
  'whats_next',
  'search',
  'recommend_talks',
  'recommend_people',
  'quest_board',
  'respond_quest',
  'make_quest',
  'quiz_for_talk',
  'submit_quiz',
  'boss_state',
  'propose_meet',
  'respond_meet',
  'list_meets',
  'leaderboard',
  'inventory',
  'world',
  'organizer_stats',
  'handshake_code',
  'start_handshake',
  'handshake_state',
  'answer_handshake',
  'save_booth_note',
  'list_booth_notes',
  'send_message',
  'list_messages',
  'recap',
] as const;
