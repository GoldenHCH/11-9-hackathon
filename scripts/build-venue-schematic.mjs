import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const venueDir = join(repoRoot, 'resources', 'venue');
const outputPath = join(repoRoot, 'web', 'public', 'venue', 'schematic.json');

const readJson = (fileName) => JSON.parse(readFileSync(join(venueDir, fileName), 'utf8'));
const sponsors = readJson('sponsors.json');
const kiosks = readJson('project_pavilion_kiosks.json');
const boothPositions = readJson('booth_positions.json');

const sp = (level, room) => `Salt Palace | ${level} | ${room}`;
const hy = (level, room) => `Hyatt Regency | ${level} | ${room}`;
const showcase = (rest) => `Salt Palace | Level 1 | Solutions Showcase | ${rest}`;

const area = (id, name, kind, x, y, width, height, extra = {}) => ({
  id,
  name,
  kind,
  shape: { x, y, width, height },
  inferred: true,
  ...extra,
});

const row = (items, x, y, totalWidth, height, gap = 8) => {
  const totalWeight = items.reduce((sum, item) => sum + (item.weight ?? 1), 0);
  const usableWidth = totalWidth - gap * (items.length - 1);
  let cursor = x;

  return items.map((item) => {
    const width = Math.round((usableWidth * (item.weight ?? 1)) / totalWeight);
    const built = area(item.id, item.name, item.kind ?? 'meeting-room', cursor, y, width, height, item.extra ?? {});
    cursor += width + gap;

    return built;
  });
};

const showcaseLevel = {
  id: 'sp-showcase',
  label: 'Showcase floor',
  width: 520,
  height: 700,
  boothSize: 11,
  areas: [
    area('sp-sc-halls-ac-c', 'Hall C · Starlight Summit', 'showcase', 30, 488, 104, 172, {
      shortLabel: 'Hall C',
      zone: 'Starlight Summit',
      description: 'Diamond and Platinum booths. Headshots, activation zones, a coffee bar and a lounge sit at the far edge.',
    }),
    area('sp-sc-halls-ac-b', 'Hall B · Starlight Summit / Astral Peak', 'showcase', 134, 488, 82, 172, {
      shortLabel: 'Hall B',
      zone: 'Starlight Summit',
      description: 'Diamond and Platinum booths, plus the Learning Lounge (LF Education talks, KubeCrawl Trivia).',
      scheduleRooms: [showcase('Hall B | Starlight Summit Zone')],
    }),
    area('sp-sc-halls-ac-a', 'Hall A · Astral Peak', 'showcase', 216, 488, 120, 172, {
      shortLabel: 'Hall A',
      zone: 'Astral Peak',
      description: 'Diamond and Platinum booths. Showcase main entrance and the Sponsorship + Membership Sales Lounge.',
    }),
    area('sp-sc-learning-lounge', 'Learning Lounge', 'theater', 140, 488, 64, 22, {
      shortLabel: 'Lounge',
      description: 'LF Education talks and KubeCrawl Trivia.',
      scheduleRooms: [showcase('Hall B | Starlight Summit Zone')],
    }),
    area('sp-sc-hall-1', 'Hall 1 · Alpine Overlook', 'showcase', 336, 422, 100, 108, {
      shortLabel: 'Hall 1',
      zone: 'Alpine Overlook',
      description: 'Gold and Platinum booths 144–191 and the Workshop Zone.',
    }),
    area('sp-sc-demo-theater', 'Demo Theater', 'theater', 438, 476, 50, 50, {
      shortLabel: 'Demo',
      description: 'Sponsor demos all day.',
      scheduleRooms: [showcase('Hall 1 | Alpine Overlook Zone | Demo Theater')],
    }),
    area('sp-sc-network-nook', 'Network Nook', 'campfire', 438, 424, 50, 48, {
      shortLabel: 'Nook',
      description: 'Scheduled meetups, next to the booths. A KubeQuest campfire.',
      scheduleRooms: [showcase('Hall 1 | Alpine Overlook Zone | Network Nook')],
    }),
    area('sp-sc-hall-2', 'Hall 2 · Honeycomb Hub', 'showcase', 336, 306, 100, 114, {
      shortLabel: 'Hall 2',
      zone: 'Honeycomb Hub',
      description: 'Silver booths 192–257. Meal area in the middle.',
    }),
    area('sp-sc-hall-3', 'Hall 3 · Amber Hive', 'showcase', 336, 208, 100, 96, {
      shortLabel: 'Hall 3',
      zone: 'Amber Hive',
      description: 'Silver booths 258–327, the Hive Zone, a relaxation station and a coffee bar.',
    }),
    area('sp-sc-halls-4-5', 'Halls 4–5 · Cosmic Canyon', 'showcase', 336, 10, 152, 196, {
      shortLabel: 'Halls 4–5',
      zone: 'Cosmic Canyon',
      description: 'Start-up booths 330–375, the Poster Pavilion, a game zone and meal pick-up.',
      scheduleRooms: ['Salt Palace | Level 1 | Halls A-C, Halls 1-5'],
    }),
    area('sp-sc-project-pavilion', 'Project Pavilion', 'pavilion', 432, 16, 52, 150, {
      shortLabel: 'Projects',
      description: 'CNCF project kiosks P-1 to P-18 (A and B sides), with a stage and a lounge. Maintainers rotate by shift.',
      scheduleRooms: [showcase('Hall 5 | Cosmic Canyon Zone | Project Pavilion')],
    }),
    area('sp-sc-cloud-native-theater', 'Cloud Native Theater', 'theater', 340, 14, 88, 30, {
      shortLabel: 'CN Theater',
      description: 'Talks inside the showcase.',
      scheduleRooms: [showcase('Halls 5 | Cosmic Canyon Zone | Cloud Native Theater')],
    }),
  ],
};

const saltPalaceLevel1 = {
  id: 'sp-l1',
  label: 'Level 1',
  width: 1000,
  height: 470,
  areas: [
    area('sp-l1-halls-1-5', 'Halls 1–5 · Solutions Showcase', 'showcase', 560, 20, 250, 220, {
      shortLabel: 'Halls 1–5',
      description: 'Gold, Silver and Start-up booths, the Demo Theater, Network Nook, Project Pavilion and Cloud Native Theater. Open "Showcase floor" for every booth.',
      connectsTo: 'sp-showcase',
    }),
    area('sp-l1-155', '155 A-F', 'meeting-room', 820, 20, 160, 220, { description: 'Meeting rooms past the Hall 1 secondary entrance.' }),
    area('sp-l1-halls-a-c', 'Halls A–C · Solutions Showcase', 'showcase', 220, 20, 330, 220, {
      shortLabel: 'Halls A–C',
      description: 'Diamond and Platinum booths and the Learning Lounge. Showcase main entrance on the concourse side.',
      connectsTo: 'sp-showcase',
    }),
    area('sp-l1-hall-de', 'Hall DE · Keynotes', 'hall', 20, 20, 190, 220, {
      shortLabel: 'Hall DE',
      description: 'Keynotes and the largest sessions. A KubeQuest boss room during keynotes.',
      scheduleRooms: [sp('Level 1', 'Hall DE')],
    }),
    area('sp-l1-lower-concourse', 'Lower Concourse', 'foyer', 20, 248, 960, 36, {
      description: 'Runs along Hall DE and Halls A–C. Lunch for Level 1 rooms is picked up near room 151.',
    }),
    area('sp-l1-badge-pickup', 'Badge Pick-Up', 'registration', 20, 292, 110, 70, {
      shortLabel: 'Badges',
      description: 'Registration and badge pick-up just inside the main entrance.',
      scheduleRooms: ['Salt Palace | 200 South Entrance (South)'],
    }),
    area('sp-l1-main-entrance', 'Main Entrance (200 South)', 'entrance', 20, 370, 110, 80, { shortLabel: 'Main entrance' }),
    area('sp-l1-hyatt-access', 'Access to Hyatt Regency', 'skybridge', 138, 292, 92, 158, {
      shortLabel: 'To Hyatt',
      description: 'The venue map labels this "Access between Hyatt Regency + Salt Palace" and points to Hyatt Level 2.',
      connectsTo: 'hy-l2',
    }),
    ...row(
      [
        { id: 'sp-l1-gb-j', name: 'Community Hub (Grand Ballroom J)', kind: 'campfire', extra: { shortLabel: 'Hub · J', description: 'Open seating meant for conversation. A KubeQuest campfire.', scheduleRooms: [sp('Level 1', 'Grand Ballroom J')] } },
        { id: 'sp-l1-gb-h', name: 'Grand Ballroom H', kind: 'ballroom', extra: { shortLabel: 'GB H', scheduleRooms: [sp('Level 1', 'Grand Ballroom H')] } },
        { id: 'sp-l1-gb-bdf', name: 'Grand Ballroom BDF', kind: 'ballroom', weight: 1.4, extra: { shortLabel: 'GB BDF', scheduleRooms: [sp('Level 1', 'Grand Ballroom BDF')] } },
      ],
      240,
      292,
      360,
      70,
    ),
    ...row(
      [
        { id: 'sp-l1-gb-gi', name: 'Grand Ballroom GI', kind: 'ballroom', extra: { shortLabel: 'GB GI', scheduleRooms: [sp('Level 1', 'Grand Ballroom GI')] } },
        { id: 'sp-l1-gb-ace', name: 'Grand Ballroom ACE', kind: 'ballroom', extra: { shortLabel: 'GB ACE', scheduleRooms: [sp('Level 1', 'Grand Ballroom ACE')] } },
      ],
      240,
      370,
      360,
      80,
    ),
    area('sp-l1-north-foyer', 'North Grand Ballroom Foyer', 'foyer', 608, 292, 90, 158, {
      shortLabel: 'N Foyer',
      scheduleRooms: [sp('Level 1', 'North Grand Ballroom Foyer')],
    }),
    area('sp-l1-150', '150 A-F', 'meeting-room', 706, 292, 130, 90),
    area('sp-l1-151', '151', 'meeting-room', 844, 292, 136, 90, { scheduleRooms: [sp('Level 1', '151 ')] }),
    area('sp-l1-west-temple', 'West Temple Entrance', 'entrance', 706, 390, 274, 60, { shortLabel: 'West Temple entrance' }),
  ],
};

const saltPalaceLevel2 = {
  id: 'sp-l2',
  label: 'Level 2',
  width: 1000,
  height: 520,
  areas: [
    ...row(
      [
        { id: 'sp-l2-250-ac', name: '250 A-C', extra: { scheduleRooms: [sp('Level 2', '250 A-C')] } },
        { id: 'sp-l2-250-df', name: '250 D-F', extra: { scheduleRooms: [sp('Level 2', '250 D-F')] } },
        { id: 'sp-l2-251-ac', name: '251 A-C', extra: { scheduleRooms: [sp('Level 2', '251 A-C')] } },
        { id: 'sp-l2-251-df', name: '251 D-F', extra: { scheduleRooms: [sp('Level 2', '251 D-F')] } },
        { id: 'sp-l2-252a', name: '252 A · Speaker Ready Room', kind: 'service', extra: { shortLabel: '252 A' } },
        { id: 'sp-l2-252b', name: '252 B' },
        { id: 'sp-l2-253', name: '253 · Speaker Lounge', kind: 'service', extra: { shortLabel: '253' } },
        { id: 'sp-l2-254', name: '254', extra: { scheduleRooms: [sp('Level 2', '254')] } },
      ],
      20,
      20,
      790,
      150,
    ),
    area('sp-l2-upper-concourse', 'Upper Concourse', 'foyer', 20, 180, 790, 50, {
      scheduleRooms: [sp('Level 2', 'Upper Mezzanine')],
      description: 'Also called the Upper Mezzanine.',
    }),
    ...row(
      [
        { id: 'sp-l2-255a', name: '255 A', extra: { scheduleRooms: [sp('Level 2', '255 A')] } },
        { id: 'sp-l2-255bc', name: '255 BC', weight: 1.4, extra: { scheduleRooms: [sp('Level 2', '255 BC')] } },
        { id: 'sp-l2-255d', name: '255 D', extra: { scheduleRooms: [sp('Level 2', '255 D')] } },
        { id: 'sp-l2-255ef', name: '255 EF', weight: 1.4, extra: { scheduleRooms: [sp('Level 2', '255 EF')] } },
        { id: 'sp-l2-257', name: '257 A-B' },
        { id: 'sp-l2-258', name: '258' },
        { id: 'sp-l2-259', name: '259' },
        { id: 'sp-l2-260', name: '260 A-B · Quiet Rooms', kind: 'service', extra: { shortLabel: '260 Quiet' } },
      ],
      20,
      240,
      790,
      150,
    ),
    area('sp-l2-north-foyer', 'North Foyer (Level 2)', 'foyer', 820, 20, 160, 370, { shortLabel: 'North Foyer' }),
    area('sp-l2-meeting-point', 'The Meeting Point', 'campfire', 832, 40, 136, 120, {
      shortLabel: 'Meeting Point',
      description: 'The venue’s own named meeting spot, marked with a pin on the official map. A KubeQuest campfire.',
    }),
    area('sp-l2-coat-check', 'Coat + Bag Check · East Registration', 'registration', 832, 180, 136, 110, {
      shortLabel: 'Coat check',
      scheduleRooms: [sp('Level 2', 'East Registration')],
    }),
  ],
};

const saltPalaceLevel3 = {
  id: 'sp-l3',
  label: 'Level 3',
  width: 1000,
  height: 260,
  areas: [
    ...row(
      [
        { id: 'sp-l3-355ac', name: '355 A-C', weight: 2 },
        { id: 'sp-l3-355d', name: '355 D · Media Lounge', kind: 'service', extra: { shortLabel: 'Media 355 D' } },
        { id: 'sp-l3-355ef', name: '355 E-F', weight: 1.4 },
      ],
      20,
      20,
      960,
      200,
    ),
  ],
};

const sponsorRoom = (id, name, sponsor) => ({
  id,
  name: `${name} · ${sponsor}`,
  extra: { shortLabel: name, description: `Sponsor meeting room: ${sponsor}. Ask at their booth for a slot.` },
});

const hyattLevels = [
  {
    id: 'hy-l1',
    label: 'Lobby',
    width: 1000,
    height: 300,
    areas: [
      area('hy-l1-lobby', 'Hyatt Regency Lobby', 'foyer', 20, 20, 640, 260, {
        description: 'Take the elevators or escalators to levels 2–5.',
        scheduleRooms: ['Hyatt Regency Lobby'],
      }),
      area('hy-l1-salt-palace', 'Access to Salt Palace', 'skybridge', 680, 20, 300, 260, { shortLabel: 'To Salt Palace', connectsTo: 'sp-l1' }),
    ],
  },
  {
    id: 'hy-l2',
    label: 'Level 2',
    width: 1000,
    height: 560,
    areas: [
      ...row(
        [
          { id: 'hy-l2-slb-a', name: 'Salt Lake Ballroom A', kind: 'ballroom', extra: { shortLabel: 'SLB A' } },
          { id: 'hy-l2-slb-b', name: 'Salt Lake Ballroom B', kind: 'ballroom', extra: { shortLabel: 'SLB B' } },
          { id: 'hy-l2-slb-c', name: 'Salt Lake Ballroom C', kind: 'ballroom', extra: { shortLabel: 'SLB C', scheduleRooms: [hy('Level 2', 'Salt Lake Ballroom C')] } },
          { id: 'hy-l2-slb-de', name: 'Salt Lake Ballroom DE', kind: 'ballroom', weight: 1.5, extra: { shortLabel: 'SLB DE', scheduleRooms: [hy('Level 2', 'Salt Lake Ballroom DE')] } },
        ],
        20,
        20,
        760,
        220,
      ),
      area('hy-l2-salt-lake-foyer', 'Salt Lake Foyer', 'campfire', 20, 250, 760, 60, {
        description: 'Outside the Salt Lake Ballrooms (south, west and east sides). A KubeQuest campfire.',
      }),
      ...row(
        [
          { id: 'hy-l2-nest', name: 'The Nest', kind: 'service' },
          { id: 'hy-l2-aspen', name: 'Aspen' },
          sponsorRoom('hy-l2-juniper', 'Juniper', 'Microsoft Azure'),
          sponsorRoom('hy-l2-cottonwood', 'Cottonwood', 'Oracle'),
          sponsorRoom('hy-l2-blue-spruce', 'Blue Spruce', 'Red Hat'),
        ],
        20,
        320,
        760,
        200,
      ),
      area('hy-l2-salt-palace', 'Arrival from Salt Palace', 'skybridge', 790, 20, 190, 500, { shortLabel: 'From Salt Palace', connectsTo: 'sp-l1' }),
    ],
  },
  {
    id: 'hy-l3',
    label: 'Level 3',
    width: 1000,
    height: 480,
    areas: [
      area('hy-l3-park-city', 'Park City', 'meeting-room', 20, 20, 300, 440, { scheduleRooms: [hy('Level 3', 'Park City')] }),
      ...row(
        [
          sponsorRoom('hy-l3-alta', 'Alta', 'VMware by Broadcom'),
          sponsorRoom('hy-l3-snowbird', 'Snowbird', 'Solo.io'),
          sponsorRoom('hy-l3-solitude', 'Solitude', 'Teleport'),
          sponsorRoom('hy-l3-brighton', 'Brighton', 'Google Cloud'),
        ],
        330,
        20,
        650,
        210,
      ),
      ...row(
        [
          sponsorRoom('hy-l3-powder-mountain', 'Powder Mountain', 'Docker'),
          sponsorRoom('hy-l3-woodward', 'Woodward', 'Nutanix'),
          sponsorRoom('hy-l3-snowbasin', 'Snowbasin', 'Isovalent'),
          { id: 'hy-l3-deer-valley', name: 'Deer Valley', extra: { description: 'Sponsor meeting room; the sponsor logo on the map is not legible.' } },
        ],
        330,
        250,
        650,
        210,
      ),
    ],
  },
  {
    id: 'hy-l4',
    label: 'Level 4',
    width: 1000,
    height: 520,
    areas: [
      ...row(
        [
          { id: 'hy-l4-rb-a', name: 'Regency Ballroom A', kind: 'ballroom', extra: { shortLabel: 'Regency A', scheduleRooms: [hy('Level 4', 'Regency Ballroom A')] } },
          {
            id: 'hy-l4-rb-b',
            name: 'Regency Ballroom B',
            kind: 'ballroom',
            extra: {
              shortLabel: 'Regency B',
              description: 'Joined with CD as "Regency Ballroom B-D" for lightning talks and larger sessions.',
              scheduleRooms: [hy('Level 4', 'Regency Ballroom B'), hy('Level 4', 'Regency Ballroom B-D')],
            },
          },
          {
            id: 'hy-l4-rb-cd',
            name: 'Regency Ballroom CD',
            kind: 'ballroom',
            weight: 1.6,
            extra: {
              shortLabel: 'Regency CD',
              description: 'Joined with B as "Regency Ballroom B-D" for lightning talks and larger sessions.',
              scheduleRooms: [hy('Level 4', 'Regency Ballroom CD'), hy('Level 4', 'Regency Ballroom B-D')],
            },
          },
        ],
        20,
        20,
        960,
        240,
      ),
      area('hy-l4-regency-foyer', 'Regency Foyer', 'campfire', 20, 270, 960, 60, {
        description: 'Outside the Regency Ballrooms, where the lightning talks run. A KubeQuest campfire.',
      }),
      ...row(
        [
          { id: 'hy-l4-traverse', name: 'Traverse' },
          { id: 'hy-l4-wasatch', name: 'Wasatch' },
          {
            id: 'hy-l4-broadcast',
            name: 'Broadcast Lounge',
            kind: 'service',
            weight: 1.8,
            extra: { description: 'Ambassador, Kubestronaut and Maintainer Lounge.' },
          },
        ],
        20,
        340,
        960,
        160,
      ),
    ],
  },
  {
    id: 'hy-l5',
    label: 'Level 5',
    width: 1000,
    height: 260,
    areas: row(
      [
        { id: 'hy-l5-zion', name: 'Zion · Prayer Room', kind: 'service', extra: { shortLabel: 'Zion (prayer)' } },
        { id: 'hy-l5-bryce', name: 'Bryce' },
        { id: 'hy-l5-canyonlands', name: 'Canyonlands' },
        { id: 'hy-l5-arches', name: 'Arches' },
        { id: 'hy-l5-capitol-reef', name: 'Capitol Reef', extra: { scheduleRooms: [hy('Level 5', 'Capitol Reef')] } },
      ],
      20,
      20,
      960,
      220,
    ),
  },
];

const showcaseAreaForSponsor = (sponsor) => {
  const boothNumber = Number.parseInt(sponsor.booth, 10);

  if (sponsor.hall === 'A' || sponsor.hall === 'B' || sponsor.hall === 'C') {
    return `sp-sc-halls-ac-${sponsor.hall.toLowerCase()}`;
  }

  if (sponsor.hall === '1') {
    return 'sp-sc-hall-1';
  }

  if (sponsor.hall === '2') {
    return 'sp-sc-hall-2';
  }

  if (sponsor.hall === '3') {
    return 'sp-sc-hall-3';
  }

  if (sponsor.hall === '4-5' || boothNumber >= 330) {
    return 'sp-sc-halls-4-5';
  }

  return undefined;
};

const slug = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const tierFor = (sponsor) => {
  const knownTiers = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Start-Up', 'End User'];

  return knownTiers.includes(sponsor.tier) ? sponsor.tier : 'Other';
};

const sponsorVendors = sponsors.flatMap((sponsor) => {
  if (!sponsor.booth) {
    return [];
  }

  return String(sponsor.booth)
    .split(/\s*[,/&]\s*|\s+and\s+/)
    .filter(Boolean)
    .map((booth) => ({
      id: `${slug(sponsor.name)}-${slug(booth)}`,
      name: sponsor.name,
      kind: 'sponsor',
      tier: tierFor(sponsor),
      booth,
      areaId: showcaseAreaForSponsor(sponsor),
      zone: sponsor.zone,
      categories: sponsor.categories ?? [],
      position: boothPositions[booth] ? { x: boothPositions[booth].x, y: boothPositions[booth].y } : undefined,
      levelId: boothPositions[booth] ? 'sp-showcase' : undefined,
    }));
});

const projectVendors = kiosks.map((kiosk) => ({
  id: `project-${slug(kiosk.project)}-${slug(kiosk.kiosk)}`,
  name: kiosk.project,
  kind: 'project',
  tier: 'Project',
  booth: kiosk.kiosk,
  areaId: 'sp-sc-project-pavilion',
  zone: 'Cosmic Canyon',
  schedule: kiosk.schedule,
}));

const schematic = {
  event: 'KubeCon + CloudNativeCon North America 2026 · Salt Lake City',
  updatedAt: '2026-11-09',
  disclaimer:
    'Schematic, not to scale. Booth numbers, tiers and booth positions on the showcase floor come from the official sponsor directory and Solutions Showcase map. Room positions on the level views are arranged by hand from the official venue map labels, so use the official map and on-site signs for wayfinding.',
  sources: [
    { label: 'Official venue map (PDF)', url: 'https://events.linuxfoundation.org/wp-content/uploads/2026/10/KCNA26-VenueMap-118x96-3.pdf' },
    { label: 'Solutions Showcase map (PDF)', url: 'https://events.linuxfoundation.org/wp-content/uploads/2026/11/KCNA26-ExpoHallMap_Digital.pdf' },
    { label: 'Sponsor directory', url: 'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/sponsor/sponsor-directory/' },
    { label: 'Project Pavilion kiosks', url: 'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/features-add-ons/project-engagement/' },
    { label: 'Schedule (Sessionize)', url: 'https://kubecon-cloudnativecon-north-america-2026.sessionize.com/' },
  ],
  buildings: [
    {
      id: 'salt-palace',
      name: 'Salt Palace Convention Center',
      shortName: 'Salt Palace',
      levels: [showcaseLevel, saltPalaceLevel1, saltPalaceLevel2, saltPalaceLevel3],
    },
    { id: 'hyatt-regency', name: 'Hyatt Regency Salt Lake City', shortName: 'Hyatt Regency', levels: hyattLevels },
  ],
  vendors: [...sponsorVendors, ...projectVendors],
};

writeFileSync(outputPath, `${JSON.stringify(schematic, null, 2)}\n`);

const placedBooths = schematic.vendors.filter((vendor) => vendor.position).length;
console.log(
  `Wrote ${outputPath}: ${schematic.buildings.length} buildings, ${schematic.vendors.length} vendors (${sponsorVendors.length} booths, ${placedBooths} placed on the floor, ${projectVendors.length} project kiosk shifts)`,
);
