import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { IGeoPoint, ILocation, IMapPoint } from '../../app/src/types/kubequest.interfaces';
import { LocationKind, Track } from '../../app/src/types/kubequest.types';
import {
  buildingCenters,
  buildingNames,
  compareBuildings,
  compareLevels,
  IParsedLocation,
  offsetGeo,
  parseLocationString,
  roomLocationId,
  slugify,
} from '../../app/src/world/locations';
import {
  categoryFixes,
  categoryPhrases,
  categoryTracks,
  exhibitorLayout,
  projectTracks,
  sponsorTierLabels,
} from '../lib/exhibitors.constants';
import { IProjectKioskRow, ISchematicVendor, ISponsorRow } from '../lib/exhibitors.interfaces';
import { offsetMeters } from '../lib/geo.helper';

type LocationSeed = Omit<ILocation, 'geo'> & { searchText: string };

type ExhibitorSeed = LocationSeed & { geo: IGeoPoint };

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
const sponsorsFile = path.join(resourcesDir, 'venue', 'sponsors.json');
const projectKiosksFile = path.join(resourcesDir, 'venue', 'project_pavilion_kiosks.json');
const schematicFile = path.join(resourcesDir, '..', 'web', 'public', 'venue', 'schematic.json');

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

const officialRoomNames: Record<string, string> = {
  '150 DEFG': '150 A-F',
  '151 G': '151',
  '155 E': '155 A-F',
  '250 AB': '250 A-C',
  '251 ABC': '251 A-C',
  '251 DEF': '251 D-F',
  '254 AB': '254',
};

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
    zone: 'Hall 5, Cosmic Canyon',
    description: 'Project updates and community talks, scheduled like a room, inside the halls.',
    hasScreen: true,
  },
  {
    name: 'The Meeting Point',
    kind: 'campfire',
    building: buildingNames.SALT_PALACE,
    level: 'Level 2',
    zone: 'North Foyer',
    description: "The venue's own named meeting spot. Meet your quest partner here.",
  },
  {
    name: 'Community Hub',
    kind: 'campfire',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Grand Ballroom J',
    description: 'Open seating meant for conversation. Meet your quest partner here.',
  },
  {
    name: 'Network Nook',
    kind: 'campfire',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Hall 1, Alpine Overlook',
    description: 'Hosts the scheduled meetups, next to the outposts.',
  },
  {
    name: 'Learning Lounge',
    kind: 'campfire',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    zone: 'Hall B, Starlight Summit, booth 140',
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
];

const handWrittenOutposts: IPlaceSeed[] = [
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
  const placeIds = new Set([...places, ...handWrittenOutposts].map((place) => placeSeed(place).id));

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
    name: officialRoomNames[parsed.room] ?? parsed.room,
    kind,
    building: parsed.building,
    level: parsed.level,
    room: officialRoomNames[parsed.room] ?? parsed.room,
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

function readJsonRows<T>(file: string): T[] {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));

  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function geoFromMap(position: IMapPoint): IGeoPoint {
  const center = buildingCenters[buildingNames.SALT_PALACE];
  const eastMeters = (position.x - exhibitorLayout.MAP_CENTER_X) * exhibitorLayout.METERS_PER_MAP_UNIT;
  const northMeters = (exhibitorLayout.MAP_CENTER_Y - position.y) * exhibitorLayout.METERS_PER_MAP_UNIT;

  return offsetMeters(center, eastMeters, northMeters);
}

function normalizeTier(tier: string): string {
  return tier.startsWith(exhibitorLayout.EXHIBITOR_TIER) ? exhibitorLayout.EXHIBITOR_TIER : tier;
}

function normalizeCategories(categories: string[] | undefined): string[] {
  return unique((categories ?? []).map((category) => categoryFixes[category] ?? category));
}

function topicsForCategories(categories: string[]): Track[] {
  const topics = unique(categories.flatMap((category) => (categoryTracks[category] ? [categoryTracks[category]] : [])));

  return topics.length > 0 ? topics : ['other'];
}

function askAboutForCategories(name: string, tier: string, categories: string[]): string {
  const phrases = unique(categories.flatMap((category) => (categoryPhrases[category] ? [categoryPhrases[category]] : []))).slice(0, 2);

  if (phrases.length > 0) {
    return `What they're building for ${phrases.join(' and ')}`;
  }

  return tier === 'Media Partner' ? `What ${name} is covering at KubeCon this week` : `What ${name} is showing at KubeCon this year`;
}

function boothLabel(booth: string | string[]): string {
  return Array.isArray(booth) ? booth.join(' / ') : booth;
}

function firstBooth(booth: string | string[]): string {
  return Array.isArray(booth) ? booth[0] : booth;
}

function uniqueId(base: string, used: Set<string>): string {
  let candidate = base;
  let suffix = 2;

  while (used.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  used.add(candidate);

  return candidate;
}

function exhibitorSearchText(seed: Omit<LocationSeed, 'searchText'>): string {
  const kindLabel = seed.exhibitorType === 'project' ? 'CNCF project kiosk' : 'sponsor booth';
  const parts = [
    `${seed.name} (${kindLabel}), ${seed.building} ${seed.level}, ${seed.zone ?? ''} zone, Hall ${seed.hall ?? ''}.`,
    seed.description ?? '',
    `Booth ${seed.boothNumber ?? ''}, ${seed.sponsorTier ?? ''} tier.`,
    seed.categories?.length ? `Categories: ${seed.categories.join(', ')}.` : '',
    seed.askAbout ? `Ask them about: ${seed.askAbout}.` : '',
    seed.topics?.length ? `Topics: ${seed.topics.join(', ')}.` : '',
    seed.schedule ? `Hours: ${seed.schedule}.` : '',
  ];

  return parts.filter((part) => part !== '').join(' ');
}

function sponsorExhibitor(
  row: ISponsorRow,
  booth: string | string[],
  handWritten: LocationSeed | undefined,
  usedIds: Set<string>,
  mapPosition: IMapPoint | undefined,
): ExhibitorSeed {
  const tier = normalizeTier(row.tier);
  const categories = normalizeCategories(row.categories);
  const boothNumber = boothLabel(booth);
  const zone = row.zone ?? 'Solutions Showcase';
  const hall = row.hall ?? '';
  const tierLabel = sponsorTierLabels[tier] ?? tier;
  const id = handWritten ? handWritten.id : uniqueId(slugify(`outpost ${row.name}`), usedIds);
  const seed: Omit<LocationSeed, 'searchText'> = {
    id,
    name: handWritten?.name ?? row.name,
    kind: 'outpost',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    room: handWritten?.name ?? row.name,
    zone,
    description: handWritten?.description ?? `${row.name}, ${tierLabel}, booth ${boothNumber} in Hall ${hall}, ${zone} zone.`,
    boothNumber,
    sponsorTier: handWritten?.sponsorTier ?? tier,
    askAbout: handWritten?.askAbout ?? askAboutForCategories(row.name, tier, categories),
    topics: handWritten?.topics ?? topicsForCategories(categories),
    hasScreen: false,
    exhibitorType: 'sponsor',
    categories: categories.length > 0 ? categories : undefined,
    hall,
    mapPosition,
  };

  return {
    ...seed,
    searchText: exhibitorSearchText(seed),
    geo: geoFromMap(mapPosition ?? { x: exhibitorLayout.MAP_CENTER_X, y: exhibitorLayout.MAP_CENTER_Y }),
  };
}

function projectExhibitor(row: IProjectKioskRow, usedIds: Set<string>, mapPosition: IMapPoint | undefined): ExhibitorSeed {
  const seed: Omit<LocationSeed, 'searchText'> = {
    id: uniqueId(slugify(`outpost project ${row.project}`), usedIds),
    name: row.project,
    kind: 'outpost',
    building: buildingNames.SALT_PALACE,
    level: 'Level 1',
    room: row.project,
    zone: exhibitorLayout.PAVILION_ZONE,
    description: `${row.project} project kiosk ${row.kiosk} in the Project Pavilion. Staffed ${row.schedule}.`,
    boothNumber: row.kiosk,
    sponsorTier: exhibitorLayout.PROJECT_TIER,
    askAbout: `How to start contributing to ${row.project}`,
    topics: projectTracks[row.project] ?? ['platform'],
    hasScreen: false,
    exhibitorType: 'project',
    hall: exhibitorLayout.PAVILION_HALL,
    schedule: row.schedule,
    mapPosition,
  };

  return {
    ...seed,
    searchText: exhibitorSearchText(seed),
    geo: geoFromMap(mapPosition ?? { x: exhibitorLayout.MAP_CENTER_X, y: exhibitorLayout.MAP_CENTER_Y }),
  };
}

function vendorKey(kind: string, key: string): string {
  return `${kind}|${key}`;
}

function schematicPositions(): Map<string, IMapPoint> {
  const parsed: unknown = JSON.parse(readFileSync(schematicFile, 'utf8'));
  const vendors: ISchematicVendor[] =
    typeof parsed === 'object' && parsed !== null && Array.isArray(Reflect.get(parsed, 'vendors'))
      ? (Reflect.get(parsed, 'vendors') as ISchematicVendor[])
      : [];
  const positions = new Map<string, IMapPoint>();

  for (const vendor of vendors) {
    if (vendor.levelId !== exhibitorLayout.EXPO_LEVEL_ID || !vendor.position) {
      continue;
    }

    const key = vendor.kind === 'project' ? vendorKey('project', `${vendor.name}|${vendor.booth}`) : vendorKey('sponsor', vendor.booth);

    if (!positions.has(key)) {
      positions.set(key, { x: vendor.position.x, y: vendor.position.y });
    }
  }

  return positions;
}

function buildExhibitors(): ExhibitorSeed[] {
  const positions = schematicPositions();
  const handWrittenByBooth = new Map(
    handWrittenOutposts.flatMap((place) => (place.boothNumber ? [[place.boothNumber, placeSeed(place)] as const] : [])),
  );
  const usedIds = new Set(handWrittenOutposts.map((place) => placeSeed(place).id));
  const sponsors = readJsonRows<ISponsorRow>(sponsorsFile).flatMap((row) => {
    const booth = row.booth;

    if (booth === null || booth.length === 0) {
      return [];
    }

    return [sponsorExhibitor(row, booth, handWrittenByBooth.get(firstBooth(booth)), usedIds, positions.get(vendorKey('sponsor', firstBooth(booth))))];
  });
  const projects = readJsonRows<IProjectKioskRow>(projectKiosksFile).map((row) =>
    projectExhibitor(row, usedIds, positions.get(vendorKey('project', `${row.project}|${row.kiosk}`))),
  );

  return [...sponsors, ...projects];
}

function withoutEmptyFields(seed: LocationSeed): LocationSeed {
  return Object.fromEntries(Object.entries(seed).filter(([, value]) => value !== undefined)) as LocationSeed;
}

function compareSeeds(left: LocationSeed, right: LocationSeed): number {
  return (
    compareBuildings(left.building, right.building) ||
    compareLevels(left.level, right.level) ||
    left.kind.localeCompare(right.kind) ||
    left.name.localeCompare(right.name)
  );
}

function slotGeos(seeds: LocationSeed[]): Map<string, IGeoPoint> {
  const slots = new Map<string, number>();
  const geos = new Map<string, IGeoPoint>();

  for (const seed of [...seeds].sort(compareSeeds)) {
    const key = `${seed.building}|${seed.level}`;
    const slot = slots.get(key) ?? 0;
    slots.set(key, slot + 1);
    geos.set(seed.id, offsetGeo(seed.building, seed.level, slot));
  }

  return geos;
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

  for (const place of [...places, ...handWrittenOutposts]) {
    const seed = placeSeed(place);
    seeds.set(seed.id, seed);
  }

  const geos = slotGeos([...seeds.values()]);

  for (const exhibitor of buildExhibitors()) {
    const { geo, ...seed } = exhibitor;
    seeds.set(seed.id, seed);
    geos.set(seed.id, geo);
  }

  return [...seeds.values()].sort(compareSeeds).map((seed) => {
    const geo = geos.get(seed.id) ?? offsetGeo(seed.building, seed.level, 0);

    return { ...withoutEmptyFields(seed), geo };
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
