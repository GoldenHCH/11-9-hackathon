import { IGeoPoint } from '../types/kubequest.interfaces';

export const buildingNames = {
  SALT_PALACE: 'Salt Palace',
  HYATT_REGENCY: 'Hyatt Regency',
} as const;

export const buildingOrder: string[] = [buildingNames.SALT_PALACE, buildingNames.HYATT_REGENCY];

export const buildingCenters: Record<string, IGeoPoint> = {
  [buildingNames.SALT_PALACE]: { lat: 40.7663, lon: -111.8946 },
  [buildingNames.HYATT_REGENCY]: { lat: 40.7672, lon: -111.8937 },
};

export interface IParsedLocation {
  building: string;
  level: string;
  room: string;
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeBuilding(value: string): string {
  const lower = value.toLowerCase();

  if (lower.includes('hyatt')) {
    return buildingNames.HYATT_REGENCY;
  }

  if (lower.includes('salt palace')) {
    return buildingNames.SALT_PALACE;
  }

  return value.trim();
}

function normalizeLevel(value: string): string {
  const match = /(\d+)/.exec(value);

  return match ? `Level ${match[1]}` : value.trim();
}

export function parseLocationString(value: string): IParsedLocation | undefined {
  const parts = value
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part !== '');

  if (parts.length < 3) {
    return undefined;
  }

  const [building, level, ...rest] = parts;

  return { building: normalizeBuilding(building), level: normalizeLevel(level), room: rest.join(' | ') };
}

export function roomLocationId(parsed: IParsedLocation): string {
  return slugify(`${parsed.building} ${parsed.level} ${parsed.room}`);
}

export function locationIdFromString(value: string): string | undefined {
  const parsed = parseLocationString(value);

  return parsed ? roomLocationId(parsed) : undefined;
}

export function levelNumber(level: string): number {
  const match = /(\d+)/.exec(level);

  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

export function compareBuildings(left: string, right: string): number {
  const leftIndex = buildingOrder.indexOf(left);
  const rightIndex = buildingOrder.indexOf(right);
  const leftRank = leftIndex === -1 ? buildingOrder.length : leftIndex;
  const rightRank = rightIndex === -1 ? buildingOrder.length : rightIndex;

  return leftRank - rightRank || left.localeCompare(right);
}

export function compareLevels(left: string, right: string): number {
  return levelNumber(left) - levelNumber(right) || left.localeCompare(right);
}

export function offsetGeo(building: string, level: string, slot: number): IGeoPoint {
  const center = buildingCenters[building] ?? buildingCenters[buildingNames.SALT_PALACE];
  const levelShift = (levelNumber(level) % 10) * 0.00003;
  const row = (slot % 5) - 2;
  const column = Math.floor(slot / 5) - 1;

  return {
    lat: Number((center.lat + levelShift + row * 0.00012).toFixed(6)),
    lon: Number((center.lon + column * 0.00015).toFixed(6)),
  };
}
