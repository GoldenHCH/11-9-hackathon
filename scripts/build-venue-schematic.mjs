import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const venueDir = join(repoRoot, 'resources', 'venue');
const publicVenueDir = join(repoRoot, 'web', 'public', 'venue');
const outputPath = join(publicVenueDir, 'schematic.json');

const readJson = (fileName) => JSON.parse(readFileSync(join(venueDir, fileName), 'utf8'));
const sponsors = readJson('sponsors.json');
const kiosks = readJson('project_pavilion_kiosks.json');
const boothPositions = readJson('booth_positions.json');

const venuePdf = { label: 'Official venue map (PDF)', url: '/venue/maps/KCNA26-VenueMap.pdf' };
const expoPdf = { label: 'Official Solutions Showcase map (PDF)', url: '/venue/maps/KCNA26_ExpoHallMap.pdf' };

mkdirSync(join(publicVenueDir, 'maps'), { recursive: true });
copyFileSync(join(venueDir, 'maps', 'KCNA26-VenueMap.pdf'), join(publicVenueDir, 'maps', 'KCNA26-VenueMap.pdf'));
copyFileSync(join(venueDir, 'maps', 'KCNA26_ExpoHallMap.pdf'), join(publicVenueDir, 'maps', 'KCNA26_ExpoHallMap.pdf'));

const sp = (level, room) => `Salt Palace | ${level} | ${room}`;
const hy = (level, room) => `Hyatt Regency | ${level} | ${room}`;
const showcase = (rest) => `Salt Palace | Level 1 | Solutions Showcase | ${rest}`;

const round = (value) => Math.round(value * 10) / 10;

const frame = (originX, originY, maxX, maxY, scale) => {
  const point = ([x, y]) => ({ x: round((x - originX) * scale), y: round((y - originY) * scale) });

  const rect = (x0, y0, x1, y1) => ({ shape: { ...point([x0, y0]), width: round((x1 - x0) * scale), height: round((y1 - y0) * scale) } });

  const polygon = (points) => {
    const mapped = points.map(point);
    const xs = mapped.map((p) => p.x);
    const ys = mapped.map((p) => p.y);
    const x = Math.min(...xs);
    const y = Math.min(...ys);

    return { shape: { x, y, width: round(Math.max(...xs) - x), height: round(Math.max(...ys) - y) }, points: mapped };
  };

  const label = (text, x, y, extra = {}) => ({ text, ...point([x, y]), ...extra });

  return { point, rect, polygon, label, scale, width: round((maxX - originX) * scale), height: round((maxY - originY) * scale) };
};

const area = (id, name, kind, geometry, extra = {}) => ({ id, name, kind, ...geometry, ...extra });

const zoneFill = {
  'Cosmic Canyon': '#f4b6d2',
  'Amber Hive': '#f0b48f',
  'Honeycomb Hub': '#b9c8f0',
  'Alpine Overlook': '#9fc9a8',
  'Starlight Summit': '#a6e3c4',
  'Astral Peak': '#a9b4d8',
};

const sp1 = frame(580, 236, 1560, 1110, 1);
const saltPalaceLevel1 = {
  id: 'sp-l1',
  label: 'L1',
  title: 'Salt Palace · Level 1',
  width: sp1.width,
  height: sp1.height,
  officialMap: venuePdf,
  areas: [
    area('sp-l1-hall-de', 'Hall DE · Keynote + Breakout Room', 'hall', sp1.rect(665, 707, 936, 895), {
      shortLabel: 'Hall DE · Keynote',
      description: 'Keynotes and the largest breakouts. A KubeQuest boss room during keynotes.',
      scheduleRooms: [sp('Level 1', 'Hall DE')],
    }),
    area('sp-l1-starlight-summit', 'Halls A–C · Starlight Summit', 'showcase', sp1.polygon([[936, 707], [1230, 707], [1230, 724], [1168, 754], [1025, 895], [936, 895]]), {
      shortLabel: 'Halls A–C',
      zone: 'Starlight Summit',
      fill: zoneFill['Starlight Summit'],
      description: 'Solutions Showcase, Halls A–C (Hall C on the Hall DE side). Diamond and Platinum booths and the Learning Lounge. Open "Expo" for every booth.',
      connectsTo: 'sp-expo',
    }),
    area('sp-l1-astral-peak', 'Halls A–C · Astral Peak', 'showcase', sp1.polygon([[1230, 724], [1230, 826], [1243, 817], [1266, 792], [1271, 780], [1230, 780], [1230, 895], [1026, 895], [1168, 754]]), {
      shortLabel: 'Astral Peak',
      zone: 'Astral Peak',
      fill: zoneFill['Astral Peak'],
      description: 'The Hall A side of Halls A–C, next to the Showcase Main Entrance.',
      connectsTo: 'sp-expo',
    }),
    area('sp-l1-alpine-overlook', 'Hall 1 · Alpine Overlook', 'showcase', sp1.polygon([[1230, 664], [1424, 664], [1424, 780], [1271, 780], [1266, 792], [1243, 817], [1230, 826]]), {
      shortLabel: 'Hall 1',
      zone: 'Alpine Overlook',
      fill: zoneFill['Alpine Overlook'],
      description: 'Gold and Platinum booths, the Workshop Zone, the Demo Theater and the Network Nook.',
      connectsTo: 'sp-expo',
    }),
    area('sp-l1-honeycomb-hub', 'Hall 2 · Honeycomb Hub', 'showcase', sp1.rect(1230, 543, 1348, 664), {
      shortLabel: 'Hall 2',
      zone: 'Honeycomb Hub',
      fill: zoneFill['Honeycomb Hub'],
      description: 'Silver booths.',
      connectsTo: 'sp-expo',
    }),
    area('sp-l1-amber-hive', 'Hall 3 · Amber Hive', 'showcase', sp1.rect(1171, 457, 1424, 543), {
      shortLabel: 'Hall 3 · Amber Hive',
      zone: 'Amber Hive',
      fill: zoneFill['Amber Hive'],
      description: 'Silver booths, the Hive Zone, a coffee bar and the relaxation station.',
      connectsTo: 'sp-expo',
    }),
    area('sp-l1-cosmic-canyon', 'Halls 4–5 · Cosmic Canyon', 'showcase', sp1.rect(1171, 246, 1424, 457), {
      shortLabel: 'Halls 4–5 · Cosmic Canyon',
      labelAt: sp1.point([1240, 380]),
      zone: 'Cosmic Canyon',
      fill: zoneFill['Cosmic Canyon'],
      description: 'Start-up booths, the Project Pavilion, the Cloud Native Theater, the Corner Store and the Poster Pavilion.',
      scheduleRooms: ['Salt Palace | Level 1 | Halls A-C, Halls 1-5'],
      connectsTo: 'sp-expo',
    }),
    area('sp-l1-project-pavilion', 'Project Pavilion', 'pavilion', sp1.rect(1310, 299, 1359, 409), {
      shortLabel: 'Projects',
      description: 'CNCF project kiosks P-1 to P-18 (A and B sides), with a stage and a lounge.',
      scheduleRooms: [showcase('Hall 5 | Cosmic Canyon Zone | Project Pavilion')],
      connectsTo: 'sp-expo',
    }),
    area('sp-l1-cn-theater', 'Cloud Native Theater', 'theater', sp1.rect(1310, 250, 1364, 280), {
      shortLabel: 'CN Theater',
      scheduleRooms: [showcase('Halls 5 | Cosmic Canyon Zone | Cloud Native Theater')],
    }),
    area('sp-l1-corner-store', 'CNCF Corner Store · T-shirt pick-up', 'service', sp1.rect(1228, 250, 1290, 293), { shortLabel: 'Store' }),
    area('sp-l1-poster-pavilion', 'Poster Pavilion', 'zone', sp1.rect(1258, 431, 1337, 451), { shortLabel: 'Posters' }),
    area('sp-l1-lower-mezzanine', 'Lower Mezzanine · secondary entrance', 'foyer', sp1.rect(1348, 543, 1424, 664), { shortLabel: 'Lower Mezz' }),
    area('sp-l1-network-nook', 'Network Nook', 'campfire', sp1.rect(1371, 666, 1404, 693), {
      shortLabel: 'Nook',
      description: 'Scheduled meetups in Hall 1. A KubeQuest campfire.',
      scheduleRooms: [showcase('Hall 1 | Alpine Overlook Zone | Network Nook')],
    }),
    area('sp-l1-demo-theater', 'Demo Theater', 'theater', sp1.rect(1376, 725, 1400, 766), {
      shortLabel: 'Demo',
      scheduleRooms: [showcase('Hall 1 | Alpine Overlook Zone | Demo Theater')],
    }),
    area('sp-l1-hall1-entrance', 'Secondary entrance (Hall 1)', 'entrance', sp1.rect(1424, 664, 1454, 780), { shortLabel: '↔' }),
    area('sp-l1-155', '155 A–F', 'void', sp1.rect(1454, 664, 1546, 780), {
      shortLabel: '155',
      description: 'Rooms 155 D–F (north row) and 155 A–C (south row), off the Hall 1 secondary entrance. Grey on the official map: not event space.',
    }),
    area('sp-l1-lower-concourse', 'Lower Concourse', 'foyer', sp1.rect(767, 895, 1245, 931), { description: 'Runs from Badge Pick-Up past the Showcase Main Entrance to the North Foyer.' }),
    area('sp-l1-badge-pickup', 'Badge Pick-Up', 'registration', sp1.rect(664, 895, 767, 932), {
      shortLabel: 'Badges',
      description: 'Registration and badge pick-up just inside the Main Entrance.',
      scheduleRooms: ['Salt Palace | 200 South Entrance (South)'],
    }),
    area('sp-l1-main-entrance', 'Main Entrance (200 South)', 'entrance', sp1.rect(604, 895, 664, 945), { shortLabel: 'Main entrance' }),
    area('sp-l1-hyatt-lobby', 'Hyatt Regency Lobby · access to Salt Palace', 'skybridge', sp1.polygon([[690, 931], [831, 931], [831, 1078], [647, 1078], [626, 1056], [647, 1035], [676, 1035], [676, 1013], [672, 999], [677, 962], [690, 962]]), {
      shortLabel: 'Hyatt Lobby',
      description: 'The official map labels this "Access between Hyatt Regency + Salt Palace". Take the elevators or escalators to Hyatt levels 2–5.',
      connectsTo: 'hy-lobby',
    }),
    area('sp-l1-gb-j', 'Community Hub · Grand Ballroom J', 'campfire', sp1.rect(841, 931, 875, 978), {
      shortLabel: 'J · Hub',
      description: 'Open seating meant for conversation. A KubeQuest campfire.',
      scheduleRooms: [sp('Level 1', 'Grand Ballroom J')],
    }),
    area('sp-l1-gb-h', 'Grand Ballroom H', 'breakout', sp1.rect(875, 931, 910, 978), { shortLabel: 'H', scheduleRooms: [sp('Level 1', 'Grand Ballroom H')] }),
    area('sp-l1-gb-bdf', 'Grand Ballroom BDF', 'breakout', sp1.rect(910, 931, 1013, 978), { shortLabel: 'BDF', scheduleRooms: [sp('Level 1', 'Grand Ballroom BDF')] }),
    area('sp-l1-gb-gi', 'Grand Ballroom GI', 'breakout', sp1.rect(841, 995, 910, 1040), { shortLabel: 'GI', scheduleRooms: [sp('Level 1', 'Grand Ballroom GI')] }),
    area('sp-l1-gb-ace', 'Grand Ballroom ACE', 'breakout', sp1.rect(910, 995, 1013, 1040), { shortLabel: 'ACE', scheduleRooms: [sp('Level 1', 'Grand Ballroom ACE')] }),
    area('sp-l1-north-foyer', 'North Foyer (Level 1)', 'foyer', sp1.rect(1013, 931, 1088, 1043), {
      shortLabel: 'N Foyer',
      description: 'Stairs and escalators up to the Level 2 North Foyer and The Meeting Point.',
      scheduleRooms: [sp('Level 1', 'North Grand Ballroom Foyer')],
      connectsTo: 'sp-l2',
    }),
    area('sp-l1-150', '150 A–F', 'meeting-room', sp1.rect(1090, 926, 1155, 973), { shortLabel: '150', description: 'Meeting rooms 150 A–C (west column) and D–F (east column).' }),
    area('sp-l1-151', '151', 'breakout', sp1.rect(1166, 926, 1232, 973), { scheduleRooms: [sp('Level 1', '151 ')] }),
    area('sp-l1-west-temple', 'West Temple Entrance', 'entrance', sp1.rect(1030, 1043, 1090, 1072), { shortLabel: 'West Temple' }),
  ],
  labels: [
    sp1.label('200 SOUTH', 592, 820, { rotate: -90 }),
    sp1.label('200 WEST', 835, 575),
    sp1.label('100 SOUTH', 1068, 360, { rotate: -90 }),
    sp1.label('WEST TEMPLE', 1300, 1095),
    sp1.label('SHOWCASE MAIN ENTRANCE', 1085, 884),
  ],
};

const ex = frame(838, 8, 1262, 600, 2);
const expoLevel = {
  id: 'sp-expo',
  label: 'L1 Expo',
  title: 'Salt Palace · Level 1 · Solutions Showcase',
  width: ex.width,
  height: ex.height,
  boothScale: ex.scale,
  officialMap: expoPdf,
  areas: [
    area('sp-x-cosmic-canyon', 'Halls 4–5 · Cosmic Canyon', 'showcase', ex.rect(1040, 14, 1244, 182), {
      shortLabel: 'Cosmic Canyon',
      zone: 'Cosmic Canyon',
      fill: zoneFill['Cosmic Canyon'],
      description: 'Start-up booths 330–375 (plus Aiven, CVS Health and Cloud Native Studios), the Game Zone, meal pick-up and seating.',
      scheduleRooms: ['Salt Palace | Level 1 | Halls A-C, Halls 1-5'],
    }),
    area('sp-x-amber-hive', 'Hall 3 · Amber Hive', 'showcase', ex.polygon([[1041, 182], [1244, 182], [1244, 274], [1088, 274], [1088, 248], [1041, 248]]), {
      shortLabel: 'Amber Hive',
      zone: 'Amber Hive',
      fill: zoneFill['Amber Hive'],
      description: 'Silver booths 258–327, the Hive Zone, a coffee bar, the relaxation station and the exhibitor services desk.',
    }),
    area('sp-x-honeycomb-hub', 'Hall 2 · Honeycomb Hub', 'showcase', ex.rect(1088, 273, 1204, 372), {
      shortLabel: 'Honeycomb Hub',
      zone: 'Honeycomb Hub',
      fill: zoneFill['Honeycomb Hub'],
      description: 'Silver booths 192–257.',
    }),
    area('sp-x-alpine-overlook', 'Hall 1 · Alpine Overlook', 'showcase', ex.polygon([[1088, 372], [1242, 372], [1242, 471], [1138, 471], [1116, 497], [1106, 424], [1088, 425]]), {
      shortLabel: 'Alpine Overlook',
      zone: 'Alpine Overlook',
      fill: zoneFill['Alpine Overlook'],
      description: 'Gold and Platinum booths 153–191, a coffee bar, the Workshop Zone, the Demo Theater and the Network Nook.',
    }),
    area('sp-x-starlight-summit', 'Halls A–C · Starlight Summit', 'showcase', ex.polygon([[848, 424], [1106, 424], [1030, 461], [918, 572], [848, 572]]), {
      shortLabel: 'Starlight Summit',
      zone: 'Starlight Summit',
      fill: zoneFill['Starlight Summit'],
      description: 'Hall C and most of Hall B: Diamond, Platinum, Gold and media booths, the Learning Lounge, activation zones, headshots and a coffee bar.',
      scheduleRooms: [showcase('Hall B | Starlight Summit Zone')],
    }),
    area('sp-x-astral-peak', 'Halls A–C · Astral Peak', 'showcase', ex.polygon([[1106, 424], [1112, 424], [1113, 502], [1082, 537], [1082, 572], [918, 572], [1030, 461]]), {
      shortLabel: 'Astral Peak',
      zone: 'Astral Peak',
      fill: zoneFill['Astral Peak'],
      description: 'Hall A and part of Hall B: Diamond and Platinum booths, the Dirty Soda Bar and the Sponsorship + Membership Sales Lounge, next to the Showcase Main Entrance.',
    }),
    area('sp-x-project-pavilion', 'Project Pavilion', 'pavilion', ex.rect(1154, 52, 1196, 144), {
      shortLabel: 'Projects',
      description: 'CNCF project kiosks P-1 to P-18, each with an A and a B side. Stage at the top, lounge in the middle. Maintainers rotate by shift.',
      scheduleRooms: [showcase('Hall 5 | Cosmic Canyon Zone | Project Pavilion')],
    }),
    area('sp-x-cn-theater', 'Cloud Native Theater', 'theater', ex.rect(1134, 19, 1179, 45), {
      shortLabel: 'CN Theater',
      scheduleRooms: [showcase('Halls 5 | Cosmic Canyon Zone | Cloud Native Theater')],
    }),
    area('sp-x-corner-store', 'CNCF Corner Store · T-shirt pick-up', 'service', ex.rect(1074, 17, 1114, 45), { shortLabel: 'Store' }),
    area('sp-x-game-zone', 'Game Zone', 'zone', ex.rect(1115, 58, 1126, 81), { shortLabel: 'Game' }),
    area('sp-x-poster-pavilion', 'Poster Pavilion', 'zone', ex.rect(1137, 172, 1173, 181), { shortLabel: 'Posters' }),
    area('sp-x-mixed-use', 'Mixed Use Space', 'service', ex.rect(1166, 153, 1196, 167), { shortLabel: 'Mixed use' }),
    area('sp-x-meal-cosmic-west', 'Meal Pick-Up', 'service', ex.rect(1046, 96, 1063, 177), { shortLabel: 'Meals' }),
    area('sp-x-meal-cosmic-east', 'Meal Pick-Up', 'service', ex.rect(1204, 134, 1221, 179), { shortLabel: 'Meals' }),
    area('sp-x-exhibitor-services', 'Exhibitor Services Desk', 'service', ex.rect(1062, 210, 1079, 249), { shortLabel: 'Services' }),
    area('sp-x-hive-zone', 'Hive Zone', 'zone', ex.rect(1168, 224, 1179, 246), { shortLabel: 'Hive' }),
    area('sp-x-relaxation', 'Relaxation Station', 'service', ex.rect(1095, 259, 1106, 286), { shortLabel: 'Relax' }),
    area('sp-x-network-nook', 'Network Nook', 'campfire', ex.rect(1202, 374, 1230, 397), {
      shortLabel: 'Nook',
      description: 'Scheduled meetups in Hall 1. A KubeQuest campfire.',
      scheduleRooms: [showcase('Hall 1 | Alpine Overlook Zone | Network Nook')],
    }),
    area('sp-x-demo-theater', 'Demo Theater', 'theater', ex.rect(1202, 424, 1223, 459), {
      shortLabel: 'Demo',
      scheduleRooms: [showcase('Hall 1 | Alpine Overlook Zone | Demo Theater')],
    }),
    area('sp-x-workshop-zone', 'Workshop Zone', 'zone', ex.rect(1145, 403, 1165, 416), { shortLabel: 'Workshop' }),
    area('sp-x-meal-ac', 'Meal Pick-Up', 'service', ex.rect(983, 424, 1073, 439), { shortLabel: 'Meal pick-up' }),
    area('sp-x-learning-lounge', 'Learning Lounge (booth 140)', 'campfire', ex.rect(941, 459, 959, 477), {
      shortLabel: '140',
      description: 'LF Education talks and KubeCrawl Trivia, in Hall B. A KubeQuest campfire.',
      scheduleRooms: [showcase('Hall B | Starlight Summit Zone')],
    }),
    area('sp-x-sales-lounge', 'Sponsorship + Membership Sales Lounge', 'service', ex.polygon([[1082, 537], [1082, 572], [1044, 572]]), { shortLabel: 'Sales' }),
    area('sp-x-main-entrance', 'Showcase Main Entrance', 'entrance', ex.rect(878, 572, 960, 590), { shortLabel: 'Main entrance' }),
    area('sp-x-secondary-hall2', 'Secondary entrance (Hall 2)', 'entrance', ex.rect(1204, 302, 1214, 326), { shortLabel: '→' }),
    area('sp-x-secondary-hall1', 'Secondary entrance (Hall 1)', 'entrance', ex.rect(1242, 405, 1252, 430), { shortLabel: '→' }),
  ],
  labels: [
    ex.label('HALL 5', 1116, 50),
    ex.label('HALL 4', 1135, 162),
    ex.label('HALL 3', 1137, 258),
    ex.label('HALL 2', 1130, 313),
    ex.label('HALL 1', 1137, 377),
    ex.label('HALL C', 890, 443),
    ex.label('HALL B', 965, 444),
    ex.label('HALL A', 1037, 444),
    ex.label('COSMIC CANYON', 1174, 148, { tone: 'zone' }),
    ex.label('AMBER HIVE', 1131, 207, { tone: 'zone' }),
    ex.label('HONEYCOMB HUB', 1132, 357, { tone: 'zone' }),
    ex.label('ALPINE OVERLOOK', 1187, 419, { tone: 'zone' }),
    ex.label('STARLIGHT SUMMIT', 926, 434, { tone: 'zone' }),
    ex.label('ASTRAL PEAK', 1037, 521, { tone: 'zone' }),
  ],
};

const sp2 = frame(1375, 430, 1860, 1062, 2);
const saltPalaceLevel2 = {
  id: 'sp-l2',
  label: 'L2',
  title: 'Salt Palace · Level 2',
  width: sp2.width,
  height: sp2.height,
  officialMap: venuePdf,
  areas: [
    area('sp-l2-upper-mezzanine', 'Upper Mezzanine', 'foyer', sp2.polygon([[1685, 440], [1720, 440], [1720, 659], [1737, 659], [1737, 678], [1747, 678], [1747, 781], [1720, 781], [1720, 794], [1691, 802], [1655, 829], [1637, 876], [1637, 893], [1599, 893], [1598, 875], [1620, 875], [1620, 866], [1602, 840], [1607, 834], [1627, 852], [1646, 823], [1672, 799], [1696, 787], [1699, 780], [1699, 657], [1678, 657], [1678, 640], [1641, 640], [1641, 543], [1698, 543], [1698, 465], [1685, 465]]), {
      shortLabel: 'Upper Mezz',
      labelAt: sp2.point([1709, 520]),
      description: 'Corridor from the Upper Concourse north to 255, 257–260 and the escalators to Level 3.',
      scheduleRooms: [sp('Level 2', 'Upper Mezzanine')],
      connectsTo: 'sp-l3',
    }),
    area('sp-l2-upper-concourse', 'Upper Concourse', 'foyer', sp2.rect(1386, 893, 1664, 927)),
    area('sp-l2-north-foyer', 'North Foyer (Level 2)', 'foyer', sp2.polygon([[1386, 927], [1430, 927], [1434, 940], [1428, 1005], [1413, 1000], [1404, 1022], [1387, 1046]]), {
      shortLabel: 'N Foyer',
      description: 'Top of the stairs and escalators from the Level 1 North Foyer.',
      connectsTo: 'sp-l1',
    }),
    area('sp-l2-meeting-point', 'The Meeting Point', 'campfire', sp2.rect(1388, 1008, 1414, 1046), {
      shortLabel: 'Meet',
      description: 'The venue’s own meeting spot: the red pin in the Level 2 North Foyer on the official map. A KubeQuest campfire.',
    }),
    area('sp-l2-coat-check', 'Coat + Bag Check · Re-entry with badge', 'registration', sp2.rect(1459, 1006, 1526, 1050), {
      shortLabel: 'Coat check',
      description: 'Coat + Bag Check (sponsored by Echo), beside re-entry with badge.',
      scheduleRooms: [sp('Level 2', 'East Registration')],
    }),
    area('sp-l2-250-ac', '250 A–C', 'breakout', sp2.rect(1459, 927, 1492, 985), { shortLabel: '250 A-C', scheduleRooms: [sp('Level 2', '250 A-C')] }),
    area('sp-l2-250-df', '250 D–F', 'breakout', sp2.rect(1492, 927, 1524, 985), { shortLabel: '250 D-F', scheduleRooms: [sp('Level 2', '250 D-F')] }),
    area('sp-l2-251-ac', '251 A–C', 'breakout', sp2.rect(1537, 927, 1569, 985), { shortLabel: '251 A-C', scheduleRooms: [sp('Level 2', '251 A-C')] }),
    area('sp-l2-251-df', '251 D–F', 'breakout', sp2.rect(1569, 927, 1602, 985), { shortLabel: '251 D-F', scheduleRooms: [sp('Level 2', '251 D-F')] }),
    area('sp-l2-252a', '252 A · Speaker Ready Room', 'service', sp2.rect(1615, 927, 1627, 946), { shortLabel: 'A' }),
    area('sp-l2-252b', '252 B', 'void', sp2.rect(1627, 927, 1638, 946), { shortLabel: 'B' }),
    area('sp-l2-253', '253 · Speaker Lounge', 'service', sp2.rect(1615, 946, 1638, 985), { shortLabel: '253' }),
    area('sp-l2-254', '254', 'breakout', sp2.polygon([[1641, 775], [1670, 803], [1652, 815], [1636, 835], [1628, 854], [1597, 824]]), { scheduleRooms: [sp('Level 2', '254')] }),
    area('sp-l2-255d', '255 D', 'breakout', sp2.rect(1747, 673, 1777, 720), { scheduleRooms: [sp('Level 2', '255 D')] }),
    area('sp-l2-255ef', '255 EF', 'breakout', sp2.rect(1777, 673, 1838, 720), { scheduleRooms: [sp('Level 2', '255 EF')] }),
    area('sp-l2-255a', '255 A', 'breakout', sp2.rect(1747, 741, 1777, 789), { scheduleRooms: [sp('Level 2', '255 A')] }),
    area('sp-l2-255bc', '255 BC', 'breakout', sp2.rect(1777, 741, 1838, 789), { scheduleRooms: [sp('Level 2', '255 BC')] }),
    area('sp-l2-260', '260 A–B · Quiet Rooms', 'service', sp2.rect(1641, 543, 1678, 559), { shortLabel: '260 Quiet' }),
    area('sp-l2-259', '259', 'meeting-room', sp2.rect(1641, 562, 1661, 600)),
    area('sp-l2-258', '258', 'meeting-room', sp2.rect(1641, 600, 1661, 636)),
    area('sp-l2-257', '257 A–B', 'meeting-room', sp2.rect(1641, 640, 1678, 657), { shortLabel: '257' }),
  ],
  labels: [sp2.label('255', 1790, 734), sp2.label('LEVEL 2', 1520, 870)],
};

const sp3 = frame(1725, 360, 1860, 490, 6);
const saltPalaceLevel3 = {
  id: 'sp-l3',
  label: 'L3',
  title: 'Salt Palace · Level 3',
  width: sp3.width,
  height: sp3.height,
  officialMap: venuePdf,
  areas: [
    area('sp-l3-lobby', 'Level 3 escalators', 'foyer', sp3.rect(1732, 367, 1759, 482), { shortLabel: 'Escalators', connectsTo: 'sp-l2' }),
    area('sp-l3-355-hall', '355 corridor', 'foyer', sp3.rect(1759, 406, 1851, 435), { shortLabel: '355' }),
    area('sp-l3-355d', '355 D · Media Lounge', 'service', sp3.rect(1759, 367, 1790, 406), { shortLabel: 'D · Media' }),
    area('sp-l3-355e', '355 E', 'meeting-room', sp3.rect(1790, 367, 1820, 414), { shortLabel: 'E' }),
    area('sp-l3-355f', '355 F', 'meeting-room', sp3.rect(1820, 367, 1851, 414), { shortLabel: 'F' }),
    area('sp-l3-355a', '355 A', 'meeting-room', sp3.rect(1759, 435, 1790, 482), { shortLabel: 'A' }),
    area('sp-l3-355b', '355 B', 'meeting-room', sp3.rect(1790, 435, 1820, 482), { shortLabel: 'B' }),
    area('sp-l3-355c', '355 C', 'meeting-room', sp3.rect(1820, 435, 1851, 482), { shortLabel: 'C' }),
  ],
  labels: [],
};

const sponsorRoom = (id, name, sponsor, geometry) =>
  area(id, `${name} · ${sponsor}`, 'sponsor-room', geometry, { shortLabel: name, description: `Sponsor meeting room: ${sponsor}. Ask at their booth for a slot.` });

const lobbyFrame = frame(600, 900, 860, 1100, 3);
const hyattLobby = {
  id: 'hy-lobby',
  label: 'Lobby',
  title: 'Hyatt Regency · Lobby',
  width: lobbyFrame.width,
  height: lobbyFrame.height,
  officialMap: venuePdf,
  areas: [
    area('hy-lobby-lobby', 'Hyatt Regency Lobby', 'foyer', lobbyFrame.polygon([[690, 931], [831, 931], [831, 1078], [647, 1078], [626, 1056], [647, 1035], [676, 1035], [676, 1013], [672, 999], [677, 962], [690, 962]]), {
      shortLabel: 'Lobby',
      description: 'Take the elevators or escalators to levels 2–5.',
      scheduleRooms: ['Hyatt Regency Lobby'],
    }),
    area('hy-lobby-elevators', 'Elevators + escalators to levels 2–5', 'foyer', lobbyFrame.rect(760, 1040, 828, 1074), { shortLabel: 'Lifts ↑', connectsTo: 'hy-l2' }),
    area('hy-lobby-salt-palace', 'Access to Salt Palace (Badge Pick-Up)', 'skybridge', lobbyFrame.rect(700, 904, 840, 930), { shortLabel: 'To Salt Palace', connectsTo: 'sp-l1' }),
  ],
  labels: [],
};

const hy2 = frame(10, 432, 800, 1005, 1);
const hyattLevel2 = {
  id: 'hy-l2',
  label: 'L2',
  title: 'Hyatt Regency · Level 2',
  width: hy2.width,
  height: hy2.height,
  officialMap: venuePdf,
  outline: hy2.polygon([[240, 440], [790, 440], [790, 968], [520, 968], [500, 1000], [345, 1000], [330, 968], [90, 968], [20, 890], [90, 808], [155, 808], [155, 545], [240, 545]]).points,
  areas: [
    area('hy-l2-slb-b', 'Salt Lake Ballroom B', 'meeting-room', hy2.rect(242, 538, 390, 645), { shortLabel: 'SLB B' }),
    area('hy-l2-slb-a', 'Salt Lake Ballroom A', 'meeting-room', hy2.rect(242, 645, 390, 755), { shortLabel: 'SLB A' }),
    area('hy-l2-slb-c', 'Salt Lake Ballroom C', 'breakout', hy2.rect(390, 538, 532, 755), { shortLabel: 'SLB C', scheduleRooms: [hy('Level 2', 'Salt Lake Ballroom C')] }),
    area('hy-l2-slb-de', 'Salt Lake Ballroom DE', 'breakout', hy2.rect(532, 538, 676, 755), { shortLabel: 'SLB DE', scheduleRooms: [hy('Level 2', 'Salt Lake Ballroom DE')] }),
    area('hy-l2-foyer-south', 'Salt Lake Foyer South', 'foyer', hy2.rect(155, 545, 242, 760), { shortLabel: 'Foyer S' }),
    area('hy-l2-salt-lake-foyer', 'Salt Lake Foyer (West)', 'campfire', hy2.rect(450, 760, 676, 850), {
      shortLabel: 'Salt Lake Foyer',
      description: 'Outside the Salt Lake Ballrooms. A KubeQuest campfire (not a named meeting point on the official map).',
    }),
    area('hy-l2-foyer-east', 'Salt Lake Foyer East', 'foyer', hy2.rect(450, 880, 578, 966), { shortLabel: 'Foyer E' }),
    area('hy-l2-nest', 'The Nest', 'service', hy2.rect(345, 810, 445, 885)),
    area('hy-l2-elevators', 'Elevator Lobby', 'foyer', hy2.rect(100, 850, 330, 966), { shortLabel: 'Elevators', connectsTo: 'hy-lobby' }),
    area('hy-l2-aspen', 'Aspen', 'void', hy2.polygon([[90, 840], [22, 890], [90, 935]]), { description: 'Grey on the official map: not an event room.' }),
    sponsorRoom('hy-l2-blue-spruce', 'Blue Spruce', 'Red Hat', hy2.rect(578, 910, 673, 965)),
    sponsorRoom('hy-l2-juniper', 'Juniper', 'Microsoft Azure', hy2.rect(715, 860, 790, 915)),
    sponsorRoom('hy-l2-cottonwood', 'Cottonwood', 'Oracle', hy2.rect(715, 920, 790, 965)),
  ],
  labels: [],
};

const hy3 = frame(25, 18, 805, 352, 1);
const hyattLevel3 = {
  id: 'hy-l3',
  label: 'L3',
  title: 'Hyatt Regency · Level 3',
  width: hy3.width,
  height: hy3.height,
  officialMap: venuePdf,
  outline: hy3.polygon([[170, 25], [797, 25], [797, 345], [110, 345], [40, 268], [110, 190], [170, 190]]).points,
  areas: [
    area('hy-l3-open', 'Open to the Salt Lake Foyer and Ballroom below', 'void', hy3.rect(170, 25, 688, 128), { shortLabel: 'Open to below' }),
    area('hy-l3-park-city', 'Park City', 'meeting-room', hy3.polygon([[110, 190], [40, 268], [110, 345]]), { scheduleRooms: [hy('Level 3', 'Park City')] }),
    area('hy-l3-elevators', 'Elevator Lobby', 'foyer', hy3.rect(130, 240, 310, 345), { shortLabel: 'Elevators', connectsTo: 'hy-lobby' }),
    sponsorRoom('hy-l3-alta', 'Alta', 'VMware by Broadcom', hy3.rect(313, 128, 375, 228)),
    sponsorRoom('hy-l3-snowbird', 'Snowbird', 'Solo.io', hy3.rect(375, 128, 437, 228)),
    sponsorRoom('hy-l3-solitude', 'Solitude', 'Teleport', hy3.rect(437, 128, 498, 228)),
    sponsorRoom('hy-l3-brighton', 'Brighton', 'Google Cloud', hy3.rect(498, 128, 560, 228)),
    sponsorRoom('hy-l3-powder-mountain', 'Powder Mountain', 'Docker', hy3.rect(590, 128, 690, 185)),
    sponsorRoom('hy-l3-woodward', 'Woodward', 'Nutanix', hy3.rect(585, 290, 680, 345)),
    sponsorRoom('hy-l3-snowbasin', 'Snowbasin', 'Isovalent', hy3.rect(717, 242, 797, 297)),
    sponsorRoom('hy-l3-deer-valley', 'Deer Valley', 'Chronosphere', hy3.rect(717, 300, 797, 345)),
  ],
  labels: [],
};

const hy4 = frame(20, 330, 810, 870, 1);
const hyattLevel4 = {
  id: 'hy-l4',
  label: 'L4',
  title: 'Hyatt Regency · Level 4',
  width: hy4.width,
  height: hy4.height,
  officialMap: venuePdf,
  outline: hy4.polygon([[250, 337], [800, 337], [800, 860], [100, 860], [30, 782], [100, 705], [165, 705], [165, 428], [250, 428]]).points,
  areas: [
    area('hy-l4-rb-a', 'Regency Ballroom A', 'breakout', hy4.rect(165, 428, 342, 705), { shortLabel: 'Regency A', scheduleRooms: [hy('Level 4', 'Regency Ballroom A')] }),
    area('hy-l4-rb-bd', 'Regency Ballroom B–D', 'breakout', hy4.rect(342, 428, 672, 705), {
      shortLabel: 'Regency B–D',
      description: 'One room on the official map. The schedule also splits it into "Regency Ballroom B" and "Regency Ballroom CD".',
      scheduleRooms: [hy('Level 4', 'Regency Ballroom B-D'), hy('Level 4', 'Regency Ballroom B'), hy('Level 4', 'Regency Ballroom CD')],
    }),
    area('hy-l4-regency-foyer', 'Regency Foyer (South + North)', 'campfire', hy4.rect(250, 705, 585, 800), {
      shortLabel: 'Regency Foyer',
      description: 'Outside the Regency Ballrooms. A KubeQuest campfire (not a named meeting point on the official map).',
    }),
    area('hy-l4-elevators', 'Elevator Lobby', 'foyer', hy4.rect(110, 705, 250, 860), { shortLabel: 'Elevators', connectsTo: 'hy-lobby' }),
    area('hy-l4-traverse', 'Traverse', 'void', hy4.polygon([[100, 705], [30, 782], [100, 860]]), { description: 'Grey on the official map: not an event room.' }),
    area('hy-l4-wasatch', 'Wasatch', 'meeting-room', hy4.rect(585, 803, 680, 860)),
    area('hy-l4-broadcast', 'Broadcast Lounge · Ambassador + Kubestronaut + Maintainer Lounge', 'service', hy4.rect(720, 715, 800, 860), { shortLabel: 'Broadcast' }),
  ],
  labels: [],
};

const hy5 = frame(15, 90, 815, 275, 1);
const hyattLevel5 = {
  id: 'hy-l5',
  label: 'L5',
  title: 'Hyatt Regency · Level 5',
  width: hy5.width,
  height: hy5.height,
  officialMap: venuePdf,
  outline: hy5.polygon([[90, 100], [805, 100], [805, 262], [90, 262], [28, 181]]).points,
  areas: [
    area('hy-l5-elevators', 'Elevator Lobby', 'foyer', hy5.rect(100, 155, 376, 250), { shortLabel: 'Elevators', connectsTo: 'hy-lobby' }),
    area('hy-l5-zion', 'Zion · Prayer Room', 'service', hy5.rect(268, 105, 312, 152), { shortLabel: 'Zion' }),
    area('hy-l5-bryce', 'Bryce', 'meeting-room', hy5.rect(312, 105, 378, 152)),
    area('hy-l5-canyonlands', 'Canyonlands', 'meeting-room', hy5.rect(378, 105, 442, 195), { shortLabel: 'Canyon-lands' }),
    area('hy-l5-arches', 'Arches', 'meeting-room', hy5.rect(442, 105, 508, 190)),
    area('hy-l5-capitol-reef', 'Capitol Reef', 'meeting-room', hy5.rect(508, 105, 572, 190), { scheduleRooms: [hy('Level 5', 'Capitol Reef')] }),
  ],
  labels: [],
};

const zoneAreaIds = {
  'Cosmic Canyon': 'sp-x-cosmic-canyon',
  'Amber Hive': 'sp-x-amber-hive',
  'Honeycomb Hub': 'sp-x-honeycomb-hub',
  'Alpine Overlook': 'sp-x-alpine-overlook',
  'Starlight Summit': 'sp-x-starlight-summit',
  'Astral Peak': 'sp-x-astral-peak',
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

const placeBooth = (booth) => {
  const position = boothPositions[booth];

  if (!position) {
    return {};
  }

  return {
    levelId: expoLevel.id,
    position: ex.point([position.x, position.y]),
    footprint: { size: round(position.size * ex.scale), rotated: position.rotated },
    zone: position.zone,
    hall: position.hall,
  };
};

const hallLabel = (hall) => (hall ? (hall.includes('-') ? `Halls ${hall.replace('-', '–')}` : `Hall ${hall}`) : undefined);

const sponsorVendors = sponsors.flatMap((sponsor) => {
  if (!sponsor.booth) {
    return [];
  }

  const booths = Array.isArray(sponsor.booth) ? sponsor.booth.map(String) : String(sponsor.booth).split(/\s*[,/&]\s*|\s+and\s+/).filter(Boolean);

  return booths.map((booth) => {
    const placed = placeBooth(booth);
    const zone = placed.zone ?? sponsor.zone;

    return {
      id: `${slug(sponsor.name)}-${slug(booth)}`,
      name: sponsor.name,
      kind: 'sponsor',
      tier: tierFor(sponsor),
      booth,
      areaId: zoneAreaIds[zone],
      zone,
      hall: hallLabel(placed.hall ?? sponsor.hall),
      categories: sponsor.categories ?? [],
      levelId: placed.levelId,
      position: placed.position,
      footprint: placed.footprint,
    };
  });
});

const projectVendors = kiosks.map((kiosk) => {
  const placed = placeBooth(kiosk.kiosk);

  return {
    id: `project-${slug(kiosk.project)}-${slug(kiosk.kiosk)}`,
    name: kiosk.project,
    kind: 'project',
    tier: 'Project',
    booth: kiosk.kiosk,
    areaId: 'sp-x-project-pavilion',
    zone: 'Cosmic Canyon',
    hall: 'Hall 5',
    schedule: kiosk.schedule,
    levelId: placed.levelId,
    position: placed.position,
    footprint: placed.footprint,
  };
});

const schematic = {
  event: 'KubeCon + CloudNativeCon North America 2026 · Salt Lake City',
  updatedAt: '2026-11-09',
  disclaimer:
    'Traced from the official KCNA26 venue map and Solutions Showcase map: rooms, halls and booths sit where those PDFs draw them, simplified to blocks. Each building view keeps its own scale. Hall letters inside Halls A–C and the hall numbers inside Cosmic Canyon and Amber Hive are inferred, because the official maps draw no walls there. Use on-site signs for wayfinding.',
  sources: [
    venuePdf,
    expoPdf,
    { label: 'Sponsor directory', url: 'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/sponsor/sponsor-directory/' },
    { label: 'Project Pavilion kiosks', url: 'https://events.linuxfoundation.org/kubecon-cloudnativecon-north-america/features-add-ons/project-engagement/' },
    { label: 'Schedule (Sessionize)', url: 'https://kubecon-cloudnativecon-north-america-2026.sessionize.com/' },
  ],
  buildings: [
    {
      id: 'salt-palace',
      name: 'Salt Palace Convention Center',
      shortName: 'Salt Palace',
      levels: [saltPalaceLevel1, expoLevel, saltPalaceLevel2, saltPalaceLevel3],
    },
    {
      id: 'hyatt-regency',
      name: 'Hyatt Regency Salt Lake City',
      shortName: 'Hyatt Regency',
      levels: [hyattLobby, hyattLevel2, hyattLevel3, hyattLevel4, hyattLevel5],
    },
  ],
  vendors: [...sponsorVendors, ...projectVendors],
};

writeFileSync(outputPath, `${JSON.stringify(schematic, null, 2)}\n`);

const placedBooths = schematic.vendors.filter((vendor) => vendor.position).length;
const unplaced = schematic.vendors.filter((vendor) => !vendor.position).map((vendor) => `${vendor.name} ${vendor.booth}`);
console.log(
  `Wrote ${outputPath}: ${schematic.buildings.length} buildings, ${schematic.vendors.length} vendors (${sponsorVendors.length} booths, ${placedBooths} placed, ${projectVendors.length} project kiosk shifts)`,
);

if (unplaced.length) {
  console.log(`Not placed: ${unplaced.join(', ')}`);
}
