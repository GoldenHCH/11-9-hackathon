export interface INavigationTab {
  path: string;
  label: string;
  icon: string;
  isPrimary: boolean;
  badge?: 'messages';
}

export const navigationTabs: readonly INavigationTab[] = [
  { path: '/quests', label: 'Quests', icon: 'flag', isPrimary: false },
  { path: '/itinerary', label: 'Itinerary', icon: 'event_note', isPrimary: false },
  { path: '/scan', label: 'Scan', icon: 'qr_code_scanner', isPrimary: true },
  { path: '/map', label: 'Map', icon: 'map', isPrimary: false },
  { path: '/messages', label: 'Messages', icon: 'forum', isPrimary: false, badge: 'messages' },
];

export const fullScreenRoutePrefixes = ['/screen/', '/onboarding', '/me/'] as const;

export const pendingScanStorageKey = 'kq.pendingScan';

export const roleViews = [
  { role: 'attendee', label: 'Attendee', icon: 'person', path: '/', description: 'Play the game: quests, booths, people' },
  { role: 'exhibitor', label: 'Exhibitor', icon: 'storefront', path: '/exhibitor', description: 'Your booth: visitors, QR, quests' },
  { role: 'organizer', label: 'Organizer', icon: 'insights', path: '/admin', description: 'The whole event: rooms, meets, booths' },
] as const;

export const staffRoutes = [
  { path: '/exhibitor', role: 'exhibitor' },
  { path: '/admin', role: 'organizer' },
] as const;
