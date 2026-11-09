import type { IGeoPoint } from '../../shared/src/index';
import type { IFixedLocation, IVenueLayout } from './data-scripts.interfaces';

export const saltPalaceCenter: IGeoPoint = { lat: 40.7673, lon: -111.896 };

export const venueLayouts: Record<string, IVenueLayout> = {
  'Salt Palace': { eastMeters: 0, northMeters: 0, spreadMeters: 35 },
  'Hyatt Regency': { eastMeters: 450, northMeters: -600, spreadMeters: 20 },
  'The Shop Workspace': { eastMeters: -700, northMeters: 1200, spreadMeters: 15 },
  'Off-Site': { eastMeters: 1800, northMeters: -1500, spreadMeters: 60 },
};

export const floorOffsets: Record<string, { eastMeters: number; northMeters: number }> = {
  'Level 1': { eastMeters: 0, northMeters: 0 },
  'Level 2': { eastMeters: 10, northMeters: 10 },
  'Level 3': { eastMeters: -10, northMeters: 10 },
  'Level 4': { eastMeters: 0, northMeters: -10 },
  'Level 5': { eastMeters: 10, northMeters: -10 },
  Ground: { eastMeters: 0, northMeters: 0 },
};

export const fixedLocations: IFixedLocation[] = [
  {
    id: 'mp-salt-palace-coffee',
    name: 'Salt Palace Coffee Bar',
    kind: 'meeting-point',
    venue: 'Salt Palace',
    floor: 'Level 1',
    eastMeters: -10,
    northMeters: -15,
  },
  {
    id: 'mp-hyatt-l4-foyer',
    name: 'Hyatt Regency Level 4 Foyer',
    kind: 'meeting-point',
    venue: 'Hyatt Regency',
    floor: 'Level 4',
    eastMeters: 450,
    northMeters: -600,
  },
  {
    id: 'mp-hackathon-venue',
    name: 'The Shop Workspace',
    kind: 'meeting-point',
    venue: 'The Shop Workspace',
    floor: 'Level 1',
    eastMeters: -700,
    northMeters: 1200,
  },
  {
    id: 'mp-network-nook',
    name: 'Network Nook',
    kind: 'meeting-point',
    venue: 'Salt Palace',
    floor: 'Level 1',
    eastMeters: 30,
    northMeters: 25,
  },
  {
    id: 'booth-elastic',
    name: 'Elastic Booth',
    kind: 'booth',
    venue: 'Salt Palace',
    floor: 'Level 1',
    eastMeters: 55,
    northMeters: 12,
  },
  {
    id: 'booth-dash0',
    name: 'Dash0 Booth',
    kind: 'booth',
    venue: 'Salt Palace',
    floor: 'Level 1',
    eastMeters: 70,
    northMeters: -5,
  },
  {
    id: 'booth-radar',
    name: 'Radar Booth',
    kind: 'booth',
    venue: 'Salt Palace',
    floor: 'Level 1',
    eastMeters: 62,
    northMeters: -22,
  },
];
