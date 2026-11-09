import { BannerId, Material, ProfileSettingKey } from './profile.types';

export interface IMaterialInfo {
  id: Material;
  label: string;
}

export interface ISettingOption {
  key: ProfileSettingKey;
  label: string;
  hint: string;
}

export const materialInfo: readonly IMaterialInfo[] = [
  { id: 'circuit', label: 'Circuit' },
  { id: 'stone', label: 'Stone' },
  { id: 'glass', label: 'Glass' },
  { id: 'crate', label: 'Crate' },
  { id: 'iron', label: 'Iron' },
  { id: 'copper', label: 'Copper' },
  { id: 'lantern', label: 'Lantern' },
  { id: 'wood', label: 'Wood' },
  { id: 'gold', label: 'Gold' },
];

export const bannerIcons: Record<BannerId, string> = {
  'observability-nerd': 'visibility',
  connector: 'hub',
  welcomer: 'waving_hand',
  explorer: 'explore',
  scout: 'travel_explore',
  speaker: 'mic',
};

export const settingOptions: readonly ISettingOption[] = [
  { key: 'meetingOn', label: 'Suggest people to meet', hint: 'Turning this off withdraws your open meets.' },
  { key: 'accessibleMode', label: 'Accessible mode', hint: 'Plain font everywhere, same layout.' },
  { key: 'noWalking', label: 'No-walking quests', hint: 'Only quests you can do from where you are.' },
  { key: 'hideFromLeaderboard', label: 'Hide me from the leaderboard', hint: 'You still earn XP and banners.' },
];

export const moreLinks = [
  { path: '/board', label: 'Leaderboard', icon: 'emoji_events' },
  { path: '/meets', label: 'My meets', icon: 'handshake' },
  { path: '/code', label: 'My handshake code', icon: 'qr_code_2' },
  { path: '/notes', label: 'Booth notes', icon: 'edit_note' },
  { path: '/recap', label: 'Recap', icon: 'mail' },
] as const;
