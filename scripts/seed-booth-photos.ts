import { crc32, deflateSync } from 'node:zlib';
import { runCheckIn } from '../app/src/checkin/check-in';
import { findLocation } from '../app/src/checkin/lookups';
import { closeEsClient, getEsClient } from '../app/src/es/client';
import { ensureIndices } from '../app/src/es/indices';
import { indexNames } from '../app/src/es/es.constants';
import { signLocationToken } from '../app/src/security/tokens';
import { toolRegistry } from '../app/src/tools';
import { IAttendee, ILocation } from '../app/src/types/kubequest.interfaces';

type Rgb = [number, number, number];

interface IBoothSeed {
  locationId: string;
  brand: Rgb;
  captions: string[];
}

const WIDTH = 640;
const HEIGHT = 400;
const BLOCK = 20;

const booths: IBoothSeed[] = [
  {
    locationId: 'outpost-dash0',
    brand: [234, 63, 112],
    captions: ['Sample: the Dash0 booth from the aisle', 'Sample: trace demo running on the big screen', 'Sample: ask them about OpenTelemetry-native dashboards'],
  },
  {
    locationId: 'outpost-elastic',
    brand: [0, 119, 204],
    captions: ['Sample: the Elastic booth, Solutions Showcase', 'Sample: search and Agent Builder demos on the counter'],
  },
  {
    locationId: 'outpost-docker',
    brand: [29, 99, 237],
    captions: ['Sample: the Docker booth before the rush', 'Sample: whale-blue counter, easy to spot'],
  },
];

const glyphs: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '10001', '11001', '10101', '10011', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '10101', '01010'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

class Canvas {
  public readonly pixels = Buffer.alloc(WIDTH * HEIGHT * 3);

  public rect(x: number, y: number, width: number, height: number, color: Rgb): void {
    for (let row = Math.max(0, y); row < Math.min(HEIGHT, y + height); row += 1) {
      for (let column = Math.max(0, x); column < Math.min(WIDTH, x + width); column += 1) {
        const offset = (row * WIDTH + column) * 3;
        this.pixels[offset] = color[0];
        this.pixels[offset + 1] = color[1];
        this.pixels[offset + 2] = color[2];
      }
    }
  }

  public block(x: number, y: number, color: Rgb): void {
    this.rect(x, y, BLOCK, BLOCK, shade(color, -40));
    this.rect(x + 2, y + 2, BLOCK - 4, BLOCK - 4, color);
    this.rect(x + 2, y + 2, BLOCK - 4, 3, shade(color, 35));
  }

  public text(value: string, x: number, y: number, scale: number, color: Rgb): void {
    let cursor = x;

    for (const character of value.toUpperCase()) {
      const glyph = glyphs[character] ?? glyphs[' '] ?? [];
      glyph.forEach((line, row) => {
        [...line].forEach((bit, column) => {
          if (bit === '1') {
            this.rect(cursor + column * scale, y + row * scale, scale, scale, color);
          }
        });
      });
      cursor += 6 * scale;
    }
  }
}

function shade(color: Rgb, amount: number): Rgb {
  return color.map((channel) => Math.max(0, Math.min(255, channel + amount))) as Rgb;
}

function textWidth(value: string, scale: number): number {
  return value.length * 6 * scale - scale;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);

  return Buffer.concat([length, body, crc]);
}

function encodePng(canvas: Canvas): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(WIDTH, 0);
  header.writeUInt32BE(HEIGHT, 4);
  header[8] = 8;
  header[9] = 2;
  const raw = Buffer.alloc((WIDTH * 3 + 1) * HEIGHT);

  for (let row = 0; row < HEIGHT; row += 1) {
    canvas.pixels.copy(raw, row * (WIDTH * 3 + 1) + 1, row * WIDTH * 3, (row + 1) * WIDTH * 3);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function drawBooth(location: ILocation, brand: Rgb, variant: number): Buffer {
  const canvas = new Canvas();
  const wall: Rgb = variant % 2 === 0 ? [214, 226, 236] : [226, 220, 208];
  canvas.rect(0, 0, WIDTH, HEIGHT, wall);

  for (let x = 0; x < WIDTH; x += BLOCK) {
    for (let y = 320; y < HEIGHT; y += BLOCK) {
      canvas.block(x, y, (x / BLOCK + y / BLOCK) % 2 === 0 ? [141, 110, 99] : [121, 92, 82]);
    }
  }

  const offset = variant === 1 ? -60 : variant === 2 ? 60 : 0;
  const left = 120 + offset;

  for (let x = left; x < left + 400; x += BLOCK) {
    for (let y = 220; y < 320; y += BLOCK) {
      canvas.block(x, y, brand);
    }
  }

  canvas.rect(left + 20, 60, 360, 110, shade(brand, -60));
  canvas.rect(left + 26, 66, 348, 98, brand);
  const name = location.name.toUpperCase().slice(0, 14);
  const scale = Math.max(3, Math.min(7, Math.floor(330 / Math.max(1, textWidth(name, 1)))));
  canvas.text(name, left + 200 - Math.floor(textWidth(name, scale) / 2), 115 - Math.floor((7 * scale) / 2), scale, [255, 255, 255]);
  canvas.rect(left + 60, 170, 20, 50, [90, 90, 90]);
  canvas.rect(left + 320, 170, 20, 50, [90, 90, 90]);

  if (variant === 1) {
    canvas.rect(left + 150, 180, 100, 40, [33, 33, 33]);
    canvas.rect(left + 156, 186, 88, 28, [79, 195, 247]);
  }

  if (location.boothNumber) {
    canvas.text(`BOOTH ${location.boothNumber}`, left + 140, 262, 3, [255, 255, 255]);
  }

  canvas.rect(16, 16, textWidth('SAMPLE', 3) + 16, 37, [31, 31, 31]);
  canvas.text('SAMPLE', 24, 24, 3, [253, 216, 53]);

  return encodePng(canvas);
}

async function seedPlayers(count: number): Promise<IAttendee[]> {
  const response = await getEsClient().search<IAttendee>({
    index: indexNames.ATTENDEES,
    size: count,
    query: { bool: { filter: [{ term: { visible: true } }], must_not: [{ exists: { field: 'email' } }] } },
    sort: [{ createdAt: { order: 'asc' } }],
  });

  return response.hits.hits.flatMap((hit) => (hit._source ? [{ ...hit._source, id: hit._source.id ?? hit._id ?? '' }] : []));
}

async function seedBooth(seed: IBoothSeed, players: IAttendee[], startAt: number): Promise<number> {
  const location = await findLocation(seed.locationId);

  if (!location) {
    console.warn(`skip ${seed.locationId}: not in locations`);

    return 0;
  }

  const existing = await toolRegistry.list_booth_photos.execute({ locationId: seed.locationId, limit: 30 });

  if (existing.count >= seed.captions.length) {
    console.log(`skip ${seed.locationId}: already has ${existing.count} photos`);

    return 0;
  }

  let added = 0;

  for (const [index, caption] of seed.captions.entries()) {
    const player = players[(startAt + index) % players.length];

    if (!player) {
      continue;
    }

    await runCheckIn({ attendeeId: player.id, locationId: location.id, token: signLocationToken(location.id) });
    const image = `data:image/png;base64,${drawBooth({ ...location, id: seed.locationId }, seed.brand, index).toString('base64')}`;
    const result = await toolRegistry.upload_booth_photo.execute({ attendeeId: player.id, locationId: location.id, image, caption });
    console.log(`${seed.locationId}: ${result.photo.id} by @${player.handle} (${Math.round((image.length * 3) / 4 / 1024)} KB, +${result.xp} XP)`);
    added += 1;
  }

  return added;
}

async function main(): Promise<void> {
  await ensureIndices();
  const players = await seedPlayers(9);

  if (players.length === 0) {
    throw new Error('No seeded players found. Run the attendee seed first.');
  }

  let total = 0;

  for (const [index, seed] of booths.entries()) {
    total += await seedBooth(seed, players, index * 3);
  }

  console.log(`seeded ${total} sample booth photos`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeEsClient());
