export const navigationTabs = [
  { path: '/map', label: 'Map', icon: 'map' },
  { path: '/meets', label: 'Meet', icon: 'handshake' },
  { path: '/code', label: 'My code', icon: 'qr_code_2' },
  { path: '/notes', label: 'Notes', icon: 'edit_note' },
  { path: '/recap', label: 'Recap', icon: 'mail' },
] as const;

export const fullScreenRoutePrefixes = ['/screen/'] as const;
