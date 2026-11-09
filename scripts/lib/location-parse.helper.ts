import type { IParsedLocation } from './data-scripts.interfaces';

export function parseLocationName(rawName: string): IParsedLocation {
  const parts = rawName
    .split(' | ')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 1 && parts[0] === 'Off-Site Location') {
    return { venue: 'Off-Site', floor: 'Ground', room: 'Off-Site Location' };
  }
  if (parts.length === 1 && parts[0].startsWith('Hyatt Regency')) {
    const room = parts[0].replace('Hyatt Regency', '').trim() || 'Lobby';

    return { venue: 'Hyatt Regency', floor: 'Level 1', room };
  }

  const venue = parts[0];
  if (parts.length > 1 && /^Level \d+$/.test(parts[1])) {
    return { venue, floor: parts[1], room: parts.slice(2).join(' · ') };
  }

  return { venue, floor: 'Level 1', room: parts.slice(1).join(' · ') };
}
