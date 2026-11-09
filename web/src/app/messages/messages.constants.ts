export const messagesPolling = {
  INBOX_MS: 20_000,
  THREAD_MS: 4_000,
} as const;

export const messageRules = {
  MAX_CHARS: 1000,
  SCROLL_STICK_PX: 120,
  BADGE_MAX: 9,
} as const;

export const messagesCopy = {
  TITLE: 'Messages',
  SUBTITLE: 'People you’ve met or agreed to meet',
  EMPTY: 'Meet someone to start a conversation',
  EMPTY_ACTION: 'Find people',
  NO_MATCHES: 'No conversations match that search.',
  NO_MESSAGES: 'No messages yet. Say hi and suggest a time.',
  PRIVACY: 'Messages are private between you two. Keep it professional.',
  NOT_FOUND: 'This conversation isn’t open. Messages start once you both accept a meet.',
  SEND_HINT: 'Enter to send, Shift+Enter for a new line',
} as const;

export const messagesNoticeStorageKey = 'kq.messagesPrivacySeen';
