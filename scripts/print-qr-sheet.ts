import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import jsQR from 'jsqr';
import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib';
import { PNG } from 'pngjs';
import QRCode from 'qrcode';
import { appConfig } from '../app/src/config';
import { buildScanUrl, signLocationToken, signScreenDisplayKey } from '../app/src/security/tokens';

interface ILocationRow {
  id: string;
  name: string;
  kind: string;
  building?: string;
  level?: string;
  zone?: string;
  hasScreen?: boolean;
}

interface ICard {
  title: string;
  kindLabel: string;
  place: string;
  instruction: string;
  url: string;
}

interface IGroup {
  label: string;
  cards: ICard[];
  startPage: number;
}

interface IFonts {
  bold: PDFFont;
  regular: PDFFont;
}

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 36;
const INK = rgb(0.07, 0.09, 0.15);
const MUTED = rgb(0.38, 0.42, 0.5);
const ACCENT = rgb(0.2, 0.38, 0.9);
const SCAN_INSTRUCTION = 'Scan with your phone camera to check in';

const kindOrder = ['boss-room', 'theater', 'room', 'campfire', 'outpost'];
const kindLabels: Record<string, string> = {
  'boss-room': 'Boss room',
  theater: 'Theater',
  room: 'Room',
  campfire: 'Campfire',
  outpost: 'Booth',
};
const groupLabels: Record<string, string> = {
  'boss-room': 'Boss rooms',
  theater: 'Theaters',
  room: 'Rooms',
  campfire: 'Campfires',
  outpost: 'Booths',
};

const rootDir = path.resolve(__dirname, '..');
const locationsFile = path.join(rootDir, 'resources', 'locations.json');
const outputDir = path.join(rootDir, 'output');
const outputFile = path.join(outputDir, 'qr-sheet.pdf');

function isLocationRow(value: unknown): value is ILocationRow {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'id') === 'string' &&
    typeof Reflect.get(value, 'name') === 'string' &&
    typeof Reflect.get(value, 'kind') === 'string'
  );
}

function loadLocations(): ILocationRow[] {
  const parsed: unknown = JSON.parse(readFileSync(locationsFile, 'utf8'));

  return Array.isArray(parsed) ? parsed.filter(isLocationRow) : [];
}

function pdfSafe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/[^\x20-\x7E]/g, '');
}

function screenUrl(locationId: string): string {
  const url = new URL(`/screen/${encodeURIComponent(locationId)}`, appConfig.publicBaseUrl);
  url.searchParams.set('key', signScreenDisplayKey(locationId));

  return url.toString();
}

function landingUrl(): string {
  return new URL('/', appConfig.publicBaseUrl).toString();
}

function placeLine(row: ILocationRow): string {
  return [row.building, row.level, row.zone].filter((part): part is string => Boolean(part)).join(' - ');
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';

  for (const word of pdfSafe(text).split(/\s+/).filter(Boolean)) {
    const candidate = current ? `${current} ${word}` : word;

    if (current && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

function drawQr(page: PDFPage, url: string, x: number, y: number, size: number): void {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'M' });
  const count = qr.modules.size;
  const quiet = 4;
  const cell = size / (count + quiet * 2);

  page.drawRectangle({ x, y, width: size, height: size, color: rgb(1, 1, 1) });

  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.modules.get(row, col)) {
        page.drawRectangle({
          x: x + (col + quiet) * cell,
          y: y + size - (row + quiet + 1) * cell,
          width: cell + 0.05,
          height: cell + 0.05,
          color: INK,
        });
      }
    }
  }
}

function drawWordmark(page: PDFPage, fonts: IFonts, x: number, y: number, size: number): void {
  const block = size * 0.7;

  page.drawRectangle({ x, y: y - size * 0.05, width: block, height: block, color: ACCENT });
  page.drawText('KUBEQUEST', { x: x + block + size * 0.3, y, size, font: fonts.bold, color: INK });
}

function drawLines(page: PDFPage, lines: string[], font: PDFFont, size: number, x: number, startY: number, color = INK): number {
  let y = startY;

  for (const line of lines) {
    page.drawText(line, { x, y, size, font, color });
    y -= size * 1.25;
  }

  return y;
}

function drawCard(page: PDFPage, fonts: IFonts, card: ICard, top: number): void {
  const height = PAGE_HEIGHT / 2;
  const bottom = top - height;
  const qrSize = 300;
  const qrX = MARGIN;
  const qrY = bottom + (height - qrSize) / 2;
  const textX = qrX + qrSize + 24;
  const textWidth = PAGE_WIDTH - MARGIN - textX;

  drawQr(page, card.url, qrX, qrY, qrSize);

  let y = top - 64;
  drawWordmark(page, fonts, textX, y, 22);
  y -= 46;

  page.drawRectangle({ x: textX, y: y - 6, width: fonts.bold.widthOfTextAtSize(card.kindLabel.toUpperCase(), 12) + 16, height: 22, color: INK });
  page.drawText(card.kindLabel.toUpperCase(), { x: textX + 8, y, size: 12, font: fonts.bold, color: rgb(1, 1, 1) });
  y -= 40;

  y = drawLines(page, wrapText(card.title, fonts.bold, 24, textWidth), fonts.bold, 24, textX, y);
  y -= 4;
  y = drawLines(page, wrapText(card.place, fonts.regular, 12, textWidth), fonts.regular, 12, textX, y, MUTED);
  y -= 14;
  drawLines(page, wrapText(card.instruction, fonts.bold, 13, textWidth), fonts.bold, 13, textX, y, ACCENT);
}

function drawCutLine(page: PDFPage): void {
  page.drawLine({
    start: { x: 12, y: PAGE_HEIGHT / 2 },
    end: { x: PAGE_WIDTH - 12, y: PAGE_HEIGHT / 2 },
    thickness: 0.5,
    color: MUTED,
    dashArray: [4, 4],
  });
}

function drawFooter(page: PDFPage, fonts: IFonts, pageNumber: number): void {
  page.drawText(`Page ${pageNumber}`, { x: PAGE_WIDTH - MARGIN - 40, y: 14, size: 8, font: fonts.regular, color: MUTED });
}

function drawCover(page: PDFPage, fonts: IFonts, groups: IGroup[], organizerPage: number): void {
  let y = PAGE_HEIGHT - 80;
  drawWordmark(page, fonts, MARGIN, y, 36);
  y -= 40;
  page.drawText('Printed check-in QR codes', { x: MARGIN, y, size: 18, font: fonts.regular, color: MUTED });
  y -= 40;

  for (const group of groups) {
    if (y < 80) {
      return;
    }

    page.drawText(`${group.label} (${group.cards.length})`, { x: MARGIN, y, size: 15, font: fonts.bold, color: INK });
    page.drawText(`from page ${group.startPage}`, { x: PAGE_WIDTH - MARGIN - 80, y, size: 11, font: fonts.regular, color: MUTED });
    y -= 18;

    for (const card of group.cards) {
      page.drawText(pdfSafe(card.title), { x: MARGIN + 14, y, size: 9, font: fonts.regular, color: INK });
      page.drawText(pdfSafe(card.place), { x: MARGIN + 200, y, size: 9, font: fonts.regular, color: MUTED });
      y -= 11.5;
    }

    y -= 10;
  }

  page.drawText(`Organizers only: projector screens on page ${organizerPage}`, { x: MARGIN, y, size: 11, font: fonts.bold, color: ACCENT });
}

function drawOrganizerPage(page: PDFPage, fonts: IFonts, screens: ILocationRow[]): void {
  page.drawText('ORGANIZERS ONLY: projector screens', { x: MARGIN, y: PAGE_HEIGHT - 64, size: 22, font: fonts.bold, color: INK });
  page.drawText('Open on the projector laptop. Do not post these publicly.', { x: MARGIN, y: PAGE_HEIGHT - 86, size: 11, font: fonts.regular, color: MUTED });

  const cellWidth = (PAGE_WIDTH - MARGIN * 2) / 2;
  const qrSize = 220;

  screens.forEach((row, index) => {
    const col = index % 2;
    const rowIndex = Math.floor(index / 2);
    const x = MARGIN + col * cellWidth + (cellWidth - qrSize) / 2;
    const top = PAGE_HEIGHT - 110 - rowIndex * 320;

    drawQr(page, screenUrl(row.id), x, top - qrSize, qrSize);
    drawLines(page, wrapText(row.name, fonts.bold, 13, cellWidth - 20), fonts.bold, 13, x, top - qrSize - 20);
    page.drawText(pdfSafe(`/screen/${row.id}`), { x, y: top - qrSize - 52, size: 8, font: fonts.regular, color: MUTED });
  });
}

async function decodeRoundTrip(url: string): Promise<boolean> {
  const buffer = await QRCode.toBuffer(url, { errorCorrectionLevel: 'M', scale: 6, margin: 4 });
  const png = PNG.sync.read(buffer);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);

  return decoded?.data === url;
}

function buildGroups(rows: ILocationRow[]): IGroup[] {
  const entrance: IGroup = {
    label: 'Entrance',
    startPage: 0,
    cards: [
      {
        title: 'Start here',
        kindLabel: 'Entrance',
        place: 'Scan to join KubeQuest',
        instruction: 'Start here: scan to join KubeQuest',
        url: landingUrl(),
      },
    ],
  };

  const kinds = [...kindOrder, ...new Set(rows.map((row) => row.kind).filter((kind) => !kindOrder.includes(kind)))];
  const groups = kinds
    .map((kind) => ({
      label: groupLabels[kind] ?? kind,
      startPage: 0,
      cards: rows
        .filter((row) => row.kind === kind)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((row) => ({
          title: row.name,
          kindLabel: kindLabels[kind] ?? kind,
          place: placeLine(row),
          instruction: SCAN_INSTRUCTION,
          url: buildScanUrl(row.id, signLocationToken(row.id)),
        })),
    }))
    .filter((group) => group.cards.length > 0);

  return [entrance, ...groups];
}

async function main(): Promise<void> {
  if (!process.env['QR_SECRET']) {
    throw new Error('QR_SECRET is not set; add it to .env before printing QR codes.');
  }

  const rows = loadLocations();

  if (rows.length === 0) {
    throw new Error('No locations found in resources/locations.json.');
  }

  const groups = buildGroups(rows);
  let nextPage = 2;

  for (const group of groups) {
    group.startPage = nextPage;
    nextPage += Math.ceil(group.cards.length / 2);
  }

  const organizerPage = nextPage;
  const screens = rows.filter((row) => row.hasScreen === true);

  const pdf = await PDFDocument.create();
  pdf.setTitle('KubeQuest QR sheet');
  const fonts: IFonts = {
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
    regular: await pdf.embedFont(StandardFonts.Helvetica),
  };

  const cover = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawCover(cover, fonts, groups, organizerPage);
  drawFooter(cover, fonts, 1);

  for (const group of groups) {
    for (let index = 0; index < group.cards.length; index += 2) {
      const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      drawCutLine(page);
      group.cards.slice(index, index + 2).forEach((card, slot) => drawCard(page, fonts, card, PAGE_HEIGHT - slot * (PAGE_HEIGHT / 2)));
      drawFooter(page, fonts, pdf.getPageCount());
    }
  }

  if (screens.length > 0) {
    const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawOrganizerPage(page, fonts, screens);
    drawFooter(page, fonts, pdf.getPageCount());
  }

  const allCards = groups.flatMap((group) => group.cards);
  const samples = [allCards[0], allCards[1], allCards[allCards.length - 1]].filter((card): card is ICard => Boolean(card));
  const sampleUrls = [...samples.map((card) => card.url), ...screens.slice(0, 1).map((row) => screenUrl(row.id))];
  const checks = await Promise.all(sampleUrls.map((url) => decodeRoundTrip(url)));

  if (checks.some((ok) => !ok)) {
    throw new Error('QR round-trip check failed: a decoded QR did not match its URL.');
  }

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(outputFile, await pdf.save());

  process.stdout.write(
    `Wrote ${path.relative(rootDir, outputFile)}: ${pdf.getPageCount()} pages, ${allCards.length} cards, ${screens.length} screens. QR round-trip OK (${checks.length} decoded).\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
