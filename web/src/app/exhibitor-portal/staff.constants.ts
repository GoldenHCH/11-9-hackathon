export const exhibitorPollIntervalMs = 15000;

export const adminPollIntervalMs = 30000;

export const maxPollBackoffMs = 60000;

export const staffTimeZone = 'America/Denver';

export const staffKeyQueryParam = 'k';

export const badKeyErrorCode = 'bad_key';

export const staffExhibitorTierOrder = [
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

export const staffQuietTiers = ['Diamond', 'Platinum', 'Gold'] as const;

export const staffExhibitorTypeLabels = {
  sponsor: 'Sponsor',
  project: 'Project Pavilion',
} as const;
