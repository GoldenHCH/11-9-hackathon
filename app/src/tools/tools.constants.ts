export const xpRewards = {
  CHECK_IN: 10,
  QUIZ_CORRECT_ANSWER: 5,
} as const;

export const checkInRules = {
  REPEAT_WINDOW_MINUTES: 60,
} as const;

export const toolMessages = {
  INVALID_SCAN_TOKEN: "That code isn't valid any more. Scan the one on the room's door",
} as const;

export const matchWeights = {
  SHARED_TOPIC: 1,
  WELCOMER_PAIR: 2,
  SAME_LOCATION: 1.5,
  TALK_TITLE_PHRASE: 3,
  TALK_TRACK_PHRASE: 2,
  TALK_ABSTRACT_PHRASE: 1,
  TALK_TITLE_WORD: 1.5,
  TALK_TRACK_WORD: 1,
  TALK_ABSTRACT_WORD: 0.5,
} as const;

export const walking = {
  METERS_PER_MINUTE: 80,
  VENUE_SWITCH_MINUTES: 3,
} as const;

export const toolDefaults = {
  TALK_LIMIT: 5,
  PEOPLE_LIMIT: 5,
  PEOPLE_HERE_LIMIT: 10,
  LEADERBOARD_LIMIT: 10,
  SESSIONS_NEXT_HERE: 3,
  MAX_LIMIT: 50,
  QUIZ_QUESTIONS: 3,
  QUIZ_CHOICES: 4,
} as const;

export const stopWords: readonly string[] = [
  'about',
  'also',
  'and',
  'are',
  'can',
  'for',
  'from',
  'have',
  'how',
  'into',
  'its',
  'more',
  'not',
  'our',
  'that',
  'the',
  'their',
  'them',
  'this',
  'using',
  'use',
  'will',
  'with',
  'what',
  'when',
  'why',
  'you',
  'your',
];

export const fallbackRoomNames: readonly string[] = ['Main stage', 'Expo hall', 'Registration desk', 'Sponsor lounge'];

export const fallbackAbstractWords: readonly string[] = ['mainframe', 'spreadsheet', 'fax machine', 'floppy disk'];

export const levelLabels: readonly string[] = ['Introductory', 'Intermediate', 'Advanced', 'Any experience level'];
