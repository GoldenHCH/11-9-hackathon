export const topicLabels: Readonly<Record<string, string>> = {
  ai: 'AI',
  platform: 'Platform',
  operations: 'Observability + Ops',
  data: 'Data + Storage',
  security: 'Security',
  connectivity: 'Networking',
  inclusion: 'Community',
  other: 'Other',
};

export const exhibitorTypeLabels: Readonly<Record<string, string>> = {
  sponsor: 'Sponsors',
  project: 'Projects',
};

export const exhibitorTypeSingularLabels: Readonly<Record<string, string>> = {
  sponsor: 'Sponsor',
  project: 'Open source project',
};

export const exhibitorTierOrder = [
  'Diamond',
  'Platinum',
  'Gold',
  'Silver',
  'Start-Up',
  'End User',
  'Media Partner',
  'Exhibitor',
  'Project',
] as const;

export const questStatusLabels: Readonly<Record<string, string>> = {
  offered: 'Offered: accept it on your Quests tab',
  accepted: 'In progress',
  not_now: 'Snoozed',
  declined: 'Declined',
  dropped: 'Dropped',
  completed: 'Done',
  expired: 'Expired',
};

export const exhibitorDirectorySettings = {
  PAGE_SIZE: 60,
  SEARCH_DEBOUNCE_MS: 300,
  MAX_CARD_TOPICS: 3,
} as const;

export const exhibitorPageSettings = {
  LIVE_REFRESH_MS: 30000,
  EXPO_LEVEL_ID: 'sp-showcase',
  MAP_PADDING: 12,
  MARKER_SIZE: 18,
  MIN_LABEL_WIDTH: 60,
  CONFERENCE_TIME_ZONE: 'America/Denver',
} as const;

export const exhibitorErrorCodes = {
  UNKNOWN_OUTPOST: 'unknown_outpost',
  UNKNOWN_ATTENDEE: 'unknown_attendee',
} as const;

export const staleAttendeeMessage = 'We couldn’t find your player on this device. Open your personal link again to see your visits and quests.';
