export const notificationPolling = {
  INTERVAL_MS: 30_000,
  TOAST_MS: 5_000,
  LIST_LIMIT: 20,
} as const;

export const notificationTypeLabels = {
  new_quest: { icon: 'flag', label: 'New quest' },
  new_match: { icon: 'group', label: 'Someone to meet' },
  meet_offer: { icon: 'waving_hand', label: 'Meet offer' },
  meet_accepted: { icon: 'handshake', label: 'Meet is on' },
  banner: { icon: 'military_tech', label: 'New banner' },
} as const;

export const notificationCopy = {
  EMPTY: 'Nothing new. Scan a room to get quests.',
  TITLE: 'Notifications',
  MARK_ALL: 'Mark all read',
} as const;
