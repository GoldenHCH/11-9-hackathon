export const navigationTabs = [
  { path: '/here', label: 'Here', icon: 'place' },
  { path: '/map', label: 'Map', icon: 'map' },
  { path: '/quests', label: 'Quests', icon: 'flag' },
  { path: '/exhibitors', label: 'Booths', icon: 'storefront' },
  { path: '/board', label: 'Board', icon: 'leaderboard' },
] as const;

export const fullScreenRoutePrefixes = ['/screen/'] as const;

export const roleViews = [
  { role: 'attendee', label: 'Attendee', icon: 'person', path: '/map', description: 'Play the game: rooms, booths, quests' },
  { role: 'exhibitor', label: 'Exhibitor', icon: 'storefront', path: '/exhibitor', description: 'Your booth: visitors, QR, quests' },
  { role: 'organizer', label: 'Organizer', icon: 'insights', path: '/admin', description: 'The whole event: rooms, meets, booths' },
] as const;

export const staffRoutes = [
  { path: '/exhibitor', role: 'exhibitor' },
  { path: '/admin', role: 'organizer' },
] as const;
