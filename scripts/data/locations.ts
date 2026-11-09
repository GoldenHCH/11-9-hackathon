import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ILocation } from '../../app/src/types/kubequest.interfaces';
import { LocationKind } from '../../app/src/types/kubequest.types';
import {
  buildingNames,
  compareBuildings,
  compareLevels,
  IParsedLocation,
  offsetGeo,
  parseLocationString,
  roomLocationId,
  slugify,
} from '../../app/src/world/locations';

type LocationSeed = Omit<ILocation, 'geo'> & { searchText: string };

interface IPlaceSeed {
  id?: string;
  name: string;
  kind: LocationKind;
  building: string;
  level: string;
  zone?: string;
  description: string;
  boothNumber?: string;
  sponsorTier?: string;
  askAbout?: string;
  topics?: string[];
  hasScreen?: boolean;
}

const resourcesDir = path.resolve(__dirname, '..', '..', 'resources');
const outputFile = path.join(resourcesDir, 'locations.json');

const sessionRoomStrings: string[] = [
  'Salt Palace | Level 1 | Hall DE',
  'Salt Palace | Level 1 | Grand Ballroom ACE',
  'Salt Palace | Level 1 | Grand Ballroom BDF',
  'Salt Palace | Level 2 | 250 AB',
  'Salt Palace | Level 2 | 251 ABC',
  'Salt Palace | Level 2 | 251 DEF',
  'Salt Palace | Level 2 | 254 AB',
  'Salt Palace | Level 2 | 255 BC',
  'Salt Palace | Level 2 | 255 EF',
  'Salt Palace | Level 1 | 150 DEFG',
  'Salt Palace | Level 1 | 151 G',
  'Salt Palace | Level 1 | 155 E',
  'Hyatt Regency | Level 2 | Salt Lake Ballroom A',
  'Hyatt Regency | Level 2 | Salt Lake Ballroom B',
  'Hyatt Regency | Level 4 | Regency Ballroom A',
  'Hyatt Regency | Level 4 | Regency Ballroom B-D',
];

const places: IPlaceSeed[] = [
  {
    id: 'cloud-native-hackathon',
    name: 'Cloud Native Hackathon',
    kind: 'boss-room',
    building: buildingNames.SALT_PALACE,
    level: 'Level 2',
    description: 'The WeMakeDevs Cloud Native Hackathon venue. Judges and hackers check in here and fight the boss together.',
    hasScreen: true,
  },
  {
    name: 'Demo Theater',
    kind: 'theater',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Solutions Showcase',
    description: 'Short sponsor and project demos, scheduled like a room, inside the Solutions Showcase halls.',
    hasScreen: true,
  },
  {
    name: 'Cloud Native Theater',
    kind: 'theater',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Project Pavilion',
    description: 'Project updates and community talks, scheduled like a room, inside the halls.',
    hasScreen: true,
  },
  {
    name: 'The Meeting Point',
    kind: 'campfire',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    description: "The venue's own named meeting spot. Meet your quest partner here.",
  },
  {
    name: 'Community Hub',
    kind: 'campfire',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    description: 'Open seating meant for conversation. Meet your quest partner here.',
  },
  {
    name: 'Network Nook',
    kind: 'campfire',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Solutions Showcase',
    description: 'Hosts the scheduled meetups, next to the outposts.',
  },
  {
    name: 'Learning Lounge',
    kind: 'campfire',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Hall B, Starlight Summit Zone',
    description: 'Named in the schedule and easy to find in the showcase.',
  },
  {
    name: 'Salt Lake Foyer',
    kind: 'campfire',
    building: buildingNames.HYATT_REGENCY,
    level: 'Level 2',
    description: 'Outside the Salt Lake Ballrooms.',
  },
  {
    name: 'Regency Foyer',
    kind: 'campfire',
    building: buildingNames.HYATT_REGENCY,
    level: 'Level 4',
    description: 'By the Regency Ballrooms, outside the lightning-talk room.',
  },
  {
    name: 'Amazon Web Services',
    kind: 'outpost',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Solutions Showcase',
    boothNumber: '115',
    sponsorTier: 'Diamond',
    askAbout: 'How EKS Auto Mode handles node upgrades for you',
    topics: ['platform', 'operations', 'ai'],
    description: 'AWS booth in the Solutions Showcase.',
  },
  {
    name: 'Google Cloud',
    kind: 'outpost',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Solutions Showcase',
    boothNumber: '122',
    sponsorTier: 'Diamond',
    askAbout: 'Serving LLM inference on GKE with GPUs and TPUs',
    topics: ['ai', 'platform'],
    description: 'Google Cloud booth in the Solutions Showcase.',
  },
  {
    name: 'HAProxy Technologies',
    kind: 'outpost',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Solutions Showcase',
    boothNumber: '124',
    sponsorTier: 'Diamond',
    askAbout: 'Moving from Ingress to Gateway API without downtime',
    topics: ['connectivity', 'security'],
    description: 'HAProxy booth in the Solutions Showcase.',
  },
  {
    name: 'Dash0',
    kind: 'outpost',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Solutions Showcase',
    boothNumber: '134',
    sponsorTier: 'Platinum',
    askAbout: 'OpenTelemetry-native observability and tracing a request end to end',
    topics: ['operations'],
    description: 'Dash0 booth in the Solutions Showcase.',
  },
  {
    name: 'Docker',
    kind: 'outpost',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Solutions Showcase',
    boothNumber: '141',
    sponsorTier: 'Platinum',
    askAbout: 'Hardened images and faster container builds',
    topics: ['platform', 'security'],
    description: 'Docker booth in the Solutions Showcase.',
  },
  {
    name: 'Datadog',
    kind: 'outpost',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Solutions Showcase',
    boothNumber: '152',
    sponsorTier: 'Platinum',
    askAbout: 'Watching Kubernetes cost and performance together',
    topics: ['operations', 'data'],
    description: 'Datadog booth in the Solutions Showcase.',
  },
  {
    name: 'Elastic',
    kind: 'outpost',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Solutions Showcase',
    boothNumber: '196',
    sponsorTier: 'Gold',
    askAbout: 'Hybrid search with semantic_text and Agent Builder',
    topics: ['ai', 'data', 'operations'],
    description: 'Elastic booth in the Solutions Showcase.',
  },
];

function readSessionRoomStrings(): string[] {
  const found: string[] = [];
  const placeIds = new Set(places.map((place) => placeSeed(place).id));

  for (const name of ['sessions.json', 'talks.json']) {
    const file = path.join(resourcesDir, name);

    if (!existsSync(file)) {
      continue;
    }

    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    const rows: unknown[] = Array.isArray(parsed) ? parsed : [];

    for (const row of rows) {
      if (typeof row !== 'object' || row === null) {
        continue;
      }

      const locationId: unknown = Reflect.get(row, 'locationId');

      if (typeof locationId === 'string' && placeIds.has(locationId)) {
        continue;
      }

      const location: unknown = Reflect.get(row, 'location') ?? Reflect.get(row, 'venue');
      const building: unknown = Reflect.get(row, 'building');
      const level: unknown = Reflect.get(row, 'level');
      const room: unknown = Reflect.get(row, 'room');

      if (typeof location === 'string' && location.includes('|')) {
        found.push(location);
      } else if (typeof building === 'string' && typeof level === 'string' && typeof room === 'string') {
        found.push(`${building} | ${level} | ${room}`);
      }
    }
  }

  return found;
}

function kindForRoom(parsed: IParsedLocation): LocationKind {
  return parsed.room === 'Hall DE' ? 'boss-room' : 'room';
}

function roomSeed(parsed: IParsedLocation): LocationSeed {
  const kind = kindForRoom(parsed);
  const description =
    kind === 'boss-room'
      ? 'Keynote hall. Check in during a keynote, then beat the boss with everyone in the room.'
      : 'Session room. Check in during a session, then take its quiz.';

  return {
    id: roomLocationId(parsed),
    name: parsed.room,
    kind,
    building: parsed.building,
    level: parsed.level,
    room: parsed.room,
    description,
    hasScreen: kind === 'boss-room',
    searchText: `${parsed.room}, ${parsed.building} ${parsed.level}. ${description}`,
  };
}

function placeSeed(place: IPlaceSeed): LocationSeed {
  const prefix = place.kind === 'outpost' ? 'outpost' : place.kind === 'campfire' ? 'campfire' : '';
  const id = place.id ?? slugify(prefix ? `${prefix} ${place.name}` : `${place.building} ${place.level} ${place.name}`);
  const searchParts = [
    `${place.name} (${place.kind}), ${place.building} ${place.level}${place.zone ? `, ${place.zone}` : ''}.`,
    place.description,
    place.boothNumber ? `Booth ${place.boothNumber}, ${place.sponsorTier ?? ''} sponsor.` : '',
    place.askAbout ? `Ask them about: ${place.askAbout}.` : '',
    place.topics?.length ? `Topics: ${place.topics.join(', ')}.` : '',
  ];

  return {
    id,
    name: place.name,
    kind: place.kind,
    building: place.building,
    level: place.level,
    room: place.name,
    zone: place.zone,
    description: place.description,
    boothNumber: place.boothNumber,
    sponsorTier: place.sponsorTier,
    askAbout: place.askAbout,
    topics: place.topics,
    hasScreen: place.hasScreen ?? false,
    searchText: searchParts.filter((part) => part !== '').join(' '),
  };
}

export function buildLocations(): (ILocation & { searchText: string })[] {
  const seeds = new Map<string, LocationSeed>();

  for (const value of [...sessionRoomStrings, ...readSessionRoomStrings()]) {
    const parsed = parseLocationString(value);

    if (parsed) {
      const seed = roomSeed(parsed);
      seeds.set(seed.id, seeds.get(seed.id) ?? seed);
    }
  }

  for (const place of places) {
    const seed = placeSeed(place);
    seeds.set(seed.id, seed);
  }

  const sorted = [...seeds.values()].sort(
    (left, right) =>
      compareBuildings(left.building, right.building) ||
      compareLevels(left.level, right.level) ||
      left.kind.localeCompare(right.kind) ||
      left.name.localeCompare(right.name),
  );
  const slots = new Map<string, number>();

  return sorted.map((seed) => {
    const key = `${seed.building}|${seed.level}`;
    const slot = slots.get(key) ?? 0;
    slots.set(key, slot + 1);

    const withoutEmpty = Object.fromEntries(Object.entries(seed).filter(([, value]) => value !== undefined)) as LocationSeed;

    return { ...withoutEmpty, geo: offsetGeo(seed.building, seed.level, slot) };
  });
}

function main(): void {
  const locations = buildLocations();
  writeFileSync(outputFile, `${JSON.stringify(locations, null, 2)}\n`);

  const counts = locations.reduce<Record<string, number>>((totals, location) => {
    totals[location.kind] = (totals[location.kind] ?? 0) + 1;

    return totals;
  }, {});

  console.log(`wrote ${locations.length} locations to ${outputFile}`, counts);
}

if (require.main === module) {
  main();
}
