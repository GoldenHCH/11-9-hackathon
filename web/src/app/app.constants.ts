export interface INavigationTab {
  path: string;
  label: string;
  icon: string;
  isPrimary: boolean;
}

export const navigationTabs: readonly INavigationTab[] = [
  { path: '/quests', label: 'Quests', icon: 'flag', isPrimary: false },
  { path: '/board', label: 'Board', icon: 'leaderboard', isPrimary: false },
  { path: '/scan', label: 'Scan', icon: 'qr_code_scanner', isPrimary: true },
  { path: '/map', label: 'Map', icon: 'map', isPrimary: false },
  { path: '/profile', label: 'Profile', icon: 'person', isPrimary: false },
];

export const fullScreenRoutePrefixes = ['/screen/', '/onboarding', '/me/'] as const;

export const pendingScanStorageKey = 'kq.pendingScan';
