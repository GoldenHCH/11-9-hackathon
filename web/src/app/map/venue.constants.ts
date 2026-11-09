export const venueAreaKinds = [
  'hall',
  'showcase',
  'zone',
  'pavilion',
  'theater',
  'breakout',
  'meeting-room',
  'sponsor-room',
  'campfire',
  'foyer',
  'registration',
  'entrance',
  'skybridge',
  'service',
  'void',
] as const;

export const vendorKinds = ['sponsor', 'project'] as const;

export const vendorTiers = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Start-Up', 'End User', 'Project', 'Other'] as const;

export const venueAreaKindDisplay = {
  hall: { label: 'Keynote hall', icon: 'campaign', fill: '#e86aa6', ink: '#1c1b22', pattern: 'stone' },
  showcase: { label: 'Solutions Showcase', icon: 'storefront', fill: '#f2c46d', ink: '#1c1b22', pattern: 'none' },
  zone: { label: 'Showcase feature', icon: 'grid_view', fill: '#fff3c4', ink: '#1c1b22', pattern: 'dots' },
  pavilion: { label: 'Project Pavilion', icon: 'hub', fill: '#7fd1e6', ink: '#1c1b22', pattern: 'circuit' },
  theater: { label: 'Theater', icon: 'theaters', fill: '#b79ce8', ink: '#1c1b22', pattern: 'stripes' },
  breakout: { label: 'Breakout room (sessions)', icon: 'co_present', fill: '#f4a9cb', ink: '#1c1b22', pattern: 'none' },
  'meeting-room': { label: 'Meeting room', icon: 'meeting_room', fill: '#d23f93', ink: '#ffffff', pattern: 'none' },
  'sponsor-room': { label: 'Sponsor meeting room', icon: 'handshake', fill: '#a8963f', ink: '#ffffff', pattern: 'none' },
  campfire: { label: 'Campfire (meeting point)', icon: 'local_fire_department', fill: '#ff8a2a', ink: '#1c1b22', pattern: 'flame' },
  foyer: { label: 'Foyer / concourse', icon: 'weekend', fill: '#dde0ea', ink: '#1c1b22', pattern: 'none' },
  registration: { label: 'Registration / coat check', icon: 'badge', fill: '#6f73c9', ink: '#ffffff', pattern: 'stripes' },
  entrance: { label: 'Entrance', icon: 'login', fill: '#ffffff', ink: '#1c1b22', pattern: 'none' },
  skybridge: { label: 'Way to the other building', icon: 'directions_walk', fill: '#9a9ca3', ink: '#1c1b22', pattern: 'stripes' },
  service: { label: 'Services and lounges', icon: 'info', fill: '#c6ead9', ink: '#1c1b22', pattern: 'none' },
  void: { label: 'Not an event space', icon: 'block', fill: '#c9c9c9', ink: '#1c1b22', pattern: 'none' },
} as const;

export const vendorTierOrder = {
  Diamond: 0,
  Platinum: 1,
  Gold: 2,
  Silver: 3,
  'Start-Up': 4,
  'End User': 5,
  Project: 6,
  Other: 7,
} as const;

export const vendorTierFill = {
  Diamond: '#ed187f',
  Platinum: '#759ad0',
  Gold: '#f7d44a',
  Silver: '#bdbdbd',
  'Start-Up': '#4caf50',
  'End User': '#a782d6',
  Project: '#2fb8d9',
  Other: '#f5881e',
} as const;

export const venueSchematicUrl = '/venue/schematic.json';
