export const adminXpTypeLabels: Record<string, string> = {
  check_in: 'Check-ins',
  quiz: 'Quizzes',
  handshake: 'Meets',
  welcome: 'Welcome',
  outpost: 'Booth visits',
  boss: 'Boss rooms',
  badge: 'Badges',
};

export const adminMeetFunnelSteps = [
  { key: 'proposed', label: 'Proposed' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'met', label: 'Met' },
] as const;

export const adminQuestFunnelSteps = [
  { key: 'offered', label: 'Offered' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'completed', label: 'Completed' },
] as const;

export const adminBoothSortOptions = [
  { key: 'visits', label: 'Visits today' },
  { key: 'unique', label: 'Unique today' },
  { key: 'name', label: 'Name' },
] as const;

export const adminTopBoothCount = 10;

export const adminQuietBoothLimit = 6;
