export const venueAreaKinds = [
  'hall',
  'showcase',
  'zone',
  'pavilion',
  'theater',
  'ballroom',
  'meeting-room',
  'campfire',
  'foyer',
  'registration',
  'entrance',
  'skybridge',
  'service',
] as const;

export const vendorKinds = ['sponsor', 'project'] as const;

export const vendorTiers = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Start-Up', 'End User', 'Project', 'Other'] as const;

export const venueAreaKindDisplay = {
  hall: { label: 'Hall', icon: 'warehouse', fill: '#d9d2bf', pattern: 'stone' },
  showcase: { label: 'Solutions Showcase', icon: 'storefront', fill: '#f2c46d', pattern: 'crate' },
  zone: { label: 'Showcase zone', icon: 'grid_view', fill: '#f7dca1', pattern: 'dots' },
  pavilion: { label: 'Project Pavilion', icon: 'hub', fill: '#a8d5e2', pattern: 'circuit' },
  theater: { label: 'Theater', icon: 'theaters', fill: '#c9b6e4', pattern: 'stripes' },
  ballroom: { label: 'Ballroom', icon: 'meeting_room', fill: '#b8d8a8', pattern: 'none' },
  'meeting-room': { label: 'Session room', icon: 'door_front', fill: '#e2ecd9', pattern: 'none' },
  campfire: { label: 'Campfire (meeting point)', icon: 'local_fire_department', fill: '#ff9f43', pattern: 'flame' },
  foyer: { label: 'Foyer', icon: 'weekend', fill: '#efe9da', pattern: 'none' },
  registration: { label: 'Registration', icon: 'badge', fill: '#9fc5f8', pattern: 'stripes' },
  entrance: { label: 'Entrance', icon: 'login', fill: '#ffffff', pattern: 'none' },
  skybridge: { label: 'Walkway to the other building', icon: 'directions_walk', fill: '#c7c7c7', pattern: 'stripes' },
  service: { label: 'Services', icon: 'info', fill: '#e6e6e6', pattern: 'none' },
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
  Diamond: '#7fd6e8',
  Platinum: '#b9c4d6',
  Gold: '#f2c94c',
  Silver: '#e0e0e0',
  'Start-Up': '#9ad08a',
  'End User': '#d7b4f3',
  Project: '#a8d5e2',
  Other: '#ffb38a',
} as const;

export const venueSchematicUrl = '/venue/schematic.json';
