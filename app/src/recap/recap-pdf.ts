import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, PDFFont, PDFPage, PDFString, StandardFonts, rgb, RGB } from 'pdf-lib';
import { tracer } from '../observability/tracing';
import { pixelFace } from '../profile/face';
import { IConnection, ILinkItem } from '../types/connections.interfaces';
import { bannerCatalog } from '../types/kubequest.constants';
import { IRecapBooth } from '../types/kubequest.interfaces';
import { levelProgress } from '../xp/levels';
import { networkColors, networkGlyphs, pdfColors, pdfFonts, pdfLayout, pdfText } from './recap-pdf.constants';
import { IRecapPdfData, IRecapPdfTalk } from './recap-pdf.interfaces';
import { loadRecapPdfData } from './recap-pdf-data';

interface IFonts {
  body: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  pixel: PDFFont;
  pixelBold: PDFFont;
  hasPixelFont: boolean;
}

interface ITextRun {
  text: string;
  font: PDFFont;
  size: number;
  color: string;
  gapBefore: number;
}

const winAnsiExtras = new Set(['€', '‚', 'ƒ', '„', '…', '†', '‡', 'ˆ', '‰', 'Š', '‹', 'Œ', 'Ž', '‘', '’', '“', '”', '•', '–', '—', '˜', '™', 'š', '›', 'œ', 'ž', 'Ÿ']);
const contentWidth = pdfLayout.PAGE_WIDTH - pdfLayout.MARGIN * 2;

function color(hex: string): RGB {
  const value = Number.parseInt(hex.replace('#', ''), 16);

  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

function safeText(value: string): string {
  return [...value.replace(/\s+/g, ' ')]
    .map((character) => (character.charCodeAt(0) <= 0xff || winAnsiExtras.has(character) ? character : character === '→' ? '->' : ''))
    .join('')
    .trim();
}

function asciiText(value: string): string {
  return safeText(value)
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]/g, '');
}

function fontCandidates(): string[] {
  return [
    path.resolve(process.cwd(), 'resources', 'fonts'),
    path.resolve(process.cwd(), '..', 'resources', 'fonts'),
    path.resolve(__dirname, '..', '..', '..', 'resources', 'fonts'),
  ];
}

function readFont(fileName: string): Uint8Array | undefined {
  const directory = fontCandidates().find((candidate) => existsSync(path.join(candidate, fileName)));

  return directory ? readFileSync(path.join(directory, fileName)) : undefined;
}

async function loadFonts(doc: PDFDocument): Promise<IFonts> {
  doc.registerFontkit(fontkit);
  const [body, bold, italic] = await Promise.all([
    doc.embedFont(StandardFonts.Helvetica),
    doc.embedFont(StandardFonts.HelveticaBold),
    doc.embedFont(StandardFonts.HelveticaOblique),
  ]);
  const pixelBytes = readFont(pdfFonts.PIXEL_REGULAR);
  const pixelBoldBytes = readFont(pdfFonts.PIXEL_BOLD);

  if (!pixelBytes || !pixelBoldBytes) {
    return { body, bold, italic, pixel: bold, pixelBold: bold, hasPixelFont: false };
  }

  const [pixel, pixelBold] = await Promise.all([doc.embedFont(pixelBytes, { subset: true }), doc.embedFont(pixelBoldBytes, { subset: true })]);

  return { body, bold, italic, pixel, pixelBold, hasPixelFont: true };
}

function formatWhen(iso: string | undefined): string {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('en-US', { timeZone: pdfText.TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function bannerName(bannerId: string): string {
  const definition: unknown = Reflect.get(bannerCatalog, bannerId);
  const name = typeof definition === 'object' && definition !== null ? Reflect.get(definition, 'name') : undefined;

  return typeof name === 'string' ? name : bannerId.replace(/-/g, ' ');
}

class RecapPdfWriter {
  private _page!: PDFPage;
  private _top = 0;
  private _pageNumber = 0;

  public constructor(
    private readonly _doc: PDFDocument,
    private readonly _fonts: IFonts,
    private readonly _data: IRecapPdfData,
  ) {}

  public render(): void {
    this._cover();
    this._peopleSection();
    this._talksSection();
    this._boothsSection();
    this._itinerarySection();
    this._nextStepsSection();
  }

  private _y(top: number): number {
    return pdfLayout.PAGE_HEIGHT - top;
  }

  private _rect(x: number, top: number, width: number, height: number, fill: string, border?: string, borderWidth: number = pdfLayout.BORDER): void {
    this._page.drawRectangle({
      x,
      y: this._y(top + height),
      width,
      height,
      color: color(fill),
      ...(border ? { borderColor: color(border), borderWidth } : {}),
    });
  }

  private _block(x: number, top: number, width: number, height: number, fill: string, shadow: number = pdfLayout.SHADOW_OFFSET): void {
    this._rect(x + shadow, top + shadow, width, height, pdfColors.SHADOW);
    this._rect(x, top, width, height, fill, pdfColors.INK);
  }

  private _text(value: string, x: number, baselineTop: number, font: PDFFont, size: number, fill: string): void {
    const text = font === this._fonts.pixel || font === this._fonts.pixelBold ? asciiText(value) : safeText(value);

    if (text !== '') {
      this._page.drawText(text, { x, y: this._y(baselineTop), font, size, color: color(fill) });
    }
  }

  private _width(value: string, font: PDFFont, size: number): number {
    const text = font === this._fonts.pixel || font === this._fonts.pixelBold ? asciiText(value) : safeText(value);

    return font.widthOfTextAtSize(text, size);
  }

  private _centered(value: string, baselineTop: number, font: PDFFont, size: number, fill: string, centerX: number = pdfLayout.PAGE_WIDTH / 2): void {
    this._text(value, centerX - this._width(value, font, size) / 2, baselineTop, font, size, fill);
  }

  private _wrap(value: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = safeText(value).split(' ').filter((word) => word !== '');
    const lines: string[] = [];
    let line = '';

    for (const word of words) {
      const candidate = line === '' ? word : `${line} ${word}`;

      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
        continue;
      }

      if (line !== '') {
        lines.push(line);
      }

      let rest = word;

      while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
        let cut = rest.length - 1;

        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) {
          cut -= 1;
        }

        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }

      line = rest;
    }

    if (line !== '') {
      lines.push(line);
    }

    return lines;
  }

  private _runsHeight(runs: ITextRun[], maxWidth: number): number {
    return runs.reduce((total, run) => total + run.gapBefore + this._wrap(run.text, run.font, run.size, maxWidth).length * (run.size + pdfLayout.LINE_GAP), 0);
  }

  private _drawRuns(runs: ITextRun[], x: number, top: number, maxWidth: number): number {
    let cursor = top;

    for (const run of runs) {
      cursor += run.gapBefore;

      for (const line of this._wrap(run.text, run.font, run.size, maxWidth)) {
        cursor += run.size;
        this._text(line, x, cursor, run.font, run.size, run.color);
        cursor += pdfLayout.LINE_GAP;
      }
    }

    return cursor;
  }

  private _link(url: string, x: number, top: number, width: number, height: number): void {
    const annotation = this._doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, this._y(top + height), x + width, this._y(top)],
      Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) },
    });
    this._page.node.addAnnot(this._doc.context.register(annotation));
  }

  private _face(seed: string, x: number, top: number, cell: number, shadow: number): void {
    const face = pixelFace(seed);
    const size = cell * pdfLayout.FACE_CELLS;
    this._rect(x + shadow, top + shadow, size, size, pdfColors.SHADOW);
    face.grid.forEach((row, rowIndex) => {
      row.forEach((value, columnIndex) => {
        this._rect(x + columnIndex * cell, top + rowIndex * cell, cell, cell, face.palette[value] ?? face.palette[0] ?? pdfColors.STONE);
      });
    });
    this._page.drawRectangle({ x, y: this._y(top + size), width: size, height: size, borderColor: color(pdfColors.INK), borderWidth: pdfLayout.BORDER });
  }

  private _newPage(title: string): void {
    this._page = this._doc.addPage([pdfLayout.PAGE_WIDTH, pdfLayout.PAGE_HEIGHT]);
    this._pageNumber += 1;
    this._rect(0, 0, pdfLayout.PAGE_WIDTH, pdfLayout.PAGE_HEIGHT, pdfColors.PAGE);
    this._rect(0, 0, pdfLayout.PAGE_WIDTH, pdfLayout.HEADER_HEIGHT - 14, pdfColors.GRASS);
    this._groundStrip(pdfLayout.HEADER_HEIGHT - 14, 14, 14);
    this._text(title.toUpperCase(), pdfLayout.MARGIN + 2, 38, this._fonts.pixelBold, 22, pdfColors.INK);
    this._text(title.toUpperCase(), pdfLayout.MARGIN, 36, this._fonts.pixelBold, 22, pdfColors.CLOUD);
    const handle = `@${this._data.player.handle}`;
    this._text(handle, pdfLayout.PAGE_WIDTH - pdfLayout.MARGIN - this._width(handle, this._fonts.bold, 11), 34, this._fonts.bold, 11, pdfColors.CLOUD);
    this._footer();
    this._top = pdfLayout.HEADER_HEIGHT + 22;
  }

  private _footer(): void {
    const top = pdfLayout.PAGE_HEIGHT - pdfLayout.FOOTER_HEIGHT + 14;
    this._text('KUBEQUEST', pdfLayout.MARGIN, top, this._fonts.pixelBold, 9, pdfColors.GRASS_DARK);
    this._text(`${pdfText.CONFERENCE} · ${pdfText.CITY}`, pdfLayout.MARGIN + 74, top, this._fonts.body, 8, pdfColors.MUTED);
    const label = `${this._pageNumber}`;
    this._text(label, pdfLayout.PAGE_WIDTH - pdfLayout.MARGIN - this._width(label, this._fonts.pixel, 9), top, this._fonts.pixel, 9, pdfColors.MUTED);
  }

  private _groundStrip(top: number, height: number, cell: number): void {
    const columns = Math.ceil(pdfLayout.PAGE_WIDTH / cell);

    for (let column = 0; column < columns; column += 1) {
      const fill = column % 5 === 2 ? pdfColors.DIRT_DARK : pdfColors.DIRT;
      this._rect(column * cell, top, cell, height, fill);
    }
  }

  private _ensure(height: number, title: string): void {
    if (this._top + height > pdfLayout.PAGE_HEIGHT - pdfLayout.FOOTER_HEIGHT - 10) {
      this._newPage(`${title} (cont.)`);
    }
  }

  private _cloud(x: number, top: number, cell: number): void {
    const shape = [
      [0, 1, 1, 0, 0, 0],
      [1, 1, 1, 1, 1, 0],
      [1, 1, 1, 1, 1, 1],
    ];

    shape.forEach((row, rowIndex) => {
      row.forEach((filled, columnIndex) => {
        if (filled) {
          this._rect(x + columnIndex * cell, top + rowIndex * cell, cell, cell, pdfColors.CLOUD);
        }
      });
    });
  }

  private _cover(): void {
    this._page = this._doc.addPage([pdfLayout.PAGE_WIDTH, pdfLayout.PAGE_HEIGHT]);
    this._pageNumber += 1;
    const center = pdfLayout.PAGE_WIDTH / 2;
    const groundTop = 340;
    this._rect(0, 0, pdfLayout.PAGE_WIDTH, pdfLayout.PAGE_HEIGHT, pdfColors.PAGE);
    this._rect(0, 0, pdfLayout.PAGE_WIDTH, groundTop, pdfColors.SKY);
    this._rect(0, 0, pdfLayout.PAGE_WIDTH, 30, pdfColors.SKY_DEEP);
    this._cloud(56, 120, 12);
    this._cloud(482, 160, 10);
    this._cloud(430, 230, 9);
    this._rect(70, 44, 40, 40, pdfColors.GOLD, pdfColors.GOLD_DARK, 3);

    this._centered('KUBEQUEST', 88, this._fonts.pixelBold, 46, pdfColors.INK, center + 3);
    this._centered('KUBEQUEST', 85, this._fonts.pixelBold, 46, pdfColors.CLOUD);
    this._centered(`Your recap of ${pdfText.CONFERENCE}`, 110, this._fonts.bold, 12, pdfColors.INK);

    const cell = 22;
    const faceSize = cell * pdfLayout.FACE_CELLS;
    this._face(this._data.faceSeed, center - faceSize / 2, groundTop - faceSize - 4, cell, 7);

    this._rect(0, groundTop, pdfLayout.PAGE_WIDTH, 18, pdfColors.GRASS);
    this._rect(0, groundTop + 18, pdfLayout.PAGE_WIDTH, 4, pdfColors.GRASS_DARK);
    const blockCell = 24;

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < Math.ceil(pdfLayout.PAGE_WIDTH / blockCell); column += 1) {
        const fill = (row * 7 + column * 3) % 11 === 0 ? pdfColors.STONE : (row + column) % 2 === 0 ? pdfColors.DIRT : pdfColors.DIRT_DARK;
        this._rect(column * blockCell, groundTop + 22 + row * blockCell, blockCell, blockCell, fill);
      }
    }

    let top = groundTop + 22 + blockCell * 3 + 52;
    this._centered(`@${this._data.player.handle}`, top, this._fonts.pixelBold, 30, pdfColors.INK);

    if (this._data.realName) {
      top += 20;
      this._centered(this._data.realName, top, this._fonts.body, 12, pdfColors.MUTED);
    }

    top += 26;
    const progress = levelProgress(this._data.player.xp);
    this._centered(`LEVEL ${this._data.player.level} - ${this._data.player.levelName}`, top, this._fonts.pixelBold, 14, pdfColors.GRASS_DARK);
    top += 14;
    const barWidth = 300;
    const segments = 15;
    const segmentWidth = barWidth / segments;
    const filled = Math.round(progress.progress * segments);

    for (let segment = 0; segment < segments; segment += 1) {
      this._rect(center - barWidth / 2 + segment * segmentWidth, top, segmentWidth, 12, segment < filled ? pdfColors.GOLD : pdfColors.XP_TRACK, pdfColors.INK, 1);
    }

    top += 28;
    const nextLabel = progress.nextLevelXp !== null ? `${this._data.player.xp} XP · ${progress.nextLevelXp - this._data.player.xp} to ${progress.nextLevelName ?? 'next level'}` : `${this._data.player.xp} XP · max level`;
    this._centered(nextLabel, top, this._fonts.bold, 10, pdfColors.MUTED);

    top += 22;
    const stats: [number, string][] = [
      [this._data.totals.xp, 'XP'],
      [this._data.totals.people, 'PEOPLE'],
      [this._data.totals.talks, 'TALKS'],
      [this._data.totals.booths, 'BOOTHS'],
    ];
    const gap = 16;
    const tileWidth = (contentWidth - gap * (stats.length - 1)) / stats.length;
    stats.forEach(([value, label], index) => {
      const x = pdfLayout.MARGIN + index * (tileWidth + gap);
      this._block(x, top, tileWidth, 58, pdfColors.CARD, 4);
      this._centered(`${value}`, top + 30, this._fonts.pixelBold, 22, pdfColors.GRASS_DARK, x + tileWidth / 2);
      this._centered(label, top + 47, this._fonts.pixel, 9, pdfColors.MUTED, x + tileWidth / 2);
    });

    top += 84;
    this._bannerRow(top);
    this._footer();
  }

  private _bannerRow(top: number): void {
    const banners = this._data.player.banners.map(bannerName);
    const labels = banners.length > 0 ? banners : ['No banners yet'];
    const size = 9;
    const widths = labels.map((label) => this._width(label.toUpperCase(), this._fonts.pixelBold, size) + 22);
    const gap = 12;
    const total = widths.reduce((sum, width) => sum + width, 0) + gap * (labels.length - 1);
    let x = pdfLayout.PAGE_WIDTH / 2 - Math.min(total, contentWidth) / 2;

    labels.forEach((label, index) => {
      const width = widths[index] ?? 0;
      this._block(x, top, width, 22, banners.length > 0 ? pdfColors.GOLD : pdfColors.CHIP, 3);
      this._text(label.toUpperCase(), x + 11, top + 15, this._fonts.pixelBold, size, pdfColors.INK);
      x += width + gap;
    });
  }

  private _label(value: string): ITextRun {
    return { text: value.toUpperCase(), font: this._fonts.pixelBold, size: 8, color: pdfColors.GRASS_DARK, gapBefore: 8 };
  }

  private _body(value: string, gapBefore = 2): ITextRun {
    return { text: value, font: this._fonts.body, size: pdfLayout.BODY_SIZE, color: pdfColors.INK, gapBefore };
  }

  private _muted(value: string, gapBefore = 2): ITextRun {
    return { text: value, font: this._fonts.body, size: pdfLayout.SMALL_SIZE, color: pdfColors.MUTED, gapBefore };
  }

  private _emptyCard(message: string, title: string): void {
    this._ensure(60, title);
    this._block(pdfLayout.MARGIN, this._top, contentWidth, 44, pdfColors.CARD);
    this._text(message, pdfLayout.MARGIN + pdfLayout.CARD_PADDING, this._top + 26, this._fonts.italic, pdfLayout.BODY_SIZE, pdfColors.MUTED);
    this._top += 44 + pdfLayout.CARD_GAP;
  }

  private _chipWidth(item: ILinkItem): number {
    return this._width(item.label, this._fonts.bold, 9) + 34;
  }

  private _chipRowsHeight(items: ILinkItem[], maxWidth: number): number {
    if (items.length === 0) {
      return 0;
    }

    let rows = 1;
    let used = 0;

    for (const item of items) {
      const width = this._chipWidth(item);

      if (used > 0 && used + width > maxWidth) {
        rows += 1;
        used = 0;
      }

      used += width + 8;
    }

    return rows * 26 + 8;
  }

  private _drawChips(items: ILinkItem[], x: number, top: number, maxWidth: number): void {
    let chipX = x;
    let chipTop = top + 8;

    for (const item of items) {
      const width = this._chipWidth(item);

      if (chipX > x && chipX + width > x + maxWidth) {
        chipX = x;
        chipTop += 26;
      }

      this._rect(chipX + 2, chipTop + 2, width, 20, pdfColors.SHADOW);
      this._rect(chipX, chipTop, width, 20, pdfColors.CHIP, pdfColors.INK, 1);
      this._rect(chipX, chipTop, 20, 20, networkColors[item.network], pdfColors.INK, 1);
      const glyph = networkGlyphs[item.network];
      this._text(glyph, chipX + 10 - this._width(glyph, this._fonts.pixelBold, 7) / 2, chipTop + 13, this._fonts.pixelBold, 7, pdfColors.CLOUD);
      this._text(item.label, chipX + 26, chipTop + 13.5, this._fonts.bold, 9, pdfColors.LINK);
      this._link(item.url, chipX, chipTop, width, 20);
      chipX += width + 8;
    }
  }

  private _personRuns(connection: IConnection): ITextRun[] {
    const identity = [connection.player.realName, connection.player.headline].filter((part): part is string => !!part).join(' · ');
    const where = [connection.where ? `Met at ${connection.where.name}` : 'Met in person', formatWhen(connection.metAt)].filter((part) => part !== '').join(' · ');
    const runs: ITextRun[] = [
      { text: `@${connection.player.handle}`, font: this._fonts.bold, size: 14, color: pdfColors.INK, gapBefore: 0 },
      ...(identity ? [this._muted(identity)] : []),
      this._muted(`${where} · Level ${connection.player.level} ${connection.player.levelName}`),
    ];

    if (connection.sharedTopics.length > 0) {
      runs.push(this._muted(`You both care about ${connection.sharedTopics.join(', ')}`));
    }

    if (connection.chatPrompt) {
      runs.push({ text: `Chat prompt: ${connection.chatPrompt}`, font: this._fonts.italic, size: pdfLayout.SMALL_SIZE, color: pdfColors.INK, gapBefore: 4 });
    }

    runs.push(this._label('What we talked about'));
    runs.push(connection.note?.talkedAbout ? this._body(connection.note.talkedAbout) : this._muted('No notes yet.'));
    runs.push(this._label('Next steps'));
    runs.push(connection.note?.nextSteps ? this._body(connection.note.nextSteps) : this._muted('Add a next step in KubeQuest.'));

    if (connection.note?.followUpBy) {
      runs.push(this._muted(`Follow up by ${formatWhen(connection.note.followUpBy)}`));
    }

    return runs;
  }

  private _personCard(connection: IConnection): void {
    const padding = pdfLayout.CARD_PADDING;
    const faceCell = 6;
    const faceSize = faceCell * pdfLayout.FACE_CELLS;
    const textX = pdfLayout.MARGIN + padding + faceSize + 16;
    const textWidth = contentWidth - (textX - pdfLayout.MARGIN) - padding;
    const runs = this._personRuns(connection);
    const linksHeight = this._chipRowsHeight(connection.links, textWidth);
    const height = Math.max(faceSize + padding * 2, padding * 2 + this._runsHeight(runs, textWidth) + linksHeight);
    this._ensure(height + pdfLayout.CARD_GAP, 'People you met');
    const top = this._top;
    this._block(pdfLayout.MARGIN, top, contentWidth, height, pdfColors.CARD);
    this._rect(pdfLayout.MARGIN, top, 6, height, pdfColors.GRASS);
    this._face(connection.player.faceSeed, pdfLayout.MARGIN + padding + 4, top + padding, faceCell, 3);
    const after = this._drawRuns(runs, textX, top + padding, textWidth);
    this._drawChips(connection.links, textX, after, textWidth);
    this._top = top + height + pdfLayout.CARD_GAP;
  }

  private _peopleSection(): void {
    this._newPage('People you met');

    if (this._data.connections.length === 0) {
      this._emptyCard('No connections yet. Complete a handshake or a meet to add someone here.', 'People you met');

      return;
    }

    for (const connection of this._data.connections) {
      this._personCard(connection);
    }
  }

  private _talkRuns(talk: IRecapPdfTalk): ITextRun[] {
    const meta = [talk.room, formatWhen(talk.at)].filter((part): part is string => !!part).join(' · ');
    const runs: ITextRun[] = [{ text: talk.title, font: this._fonts.bold, size: 12, color: pdfColors.INK, gapBefore: 0 }];

    if (meta) {
      runs.push(this._muted(meta));
    }

    if (talk.speakers.length > 0) {
      runs.push(this._muted(`Speakers: ${talk.speakers.join(', ')}`));
    }

    if (talk.note?.note) {
      runs.push(this._label('My notes'));
      runs.push(this._body(talk.note.note));
    }

    if (talk.note && talk.note.takeaways.length > 0) {
      runs.push(this._label('Takeaways'));
      talk.note.takeaways.forEach((takeaway) => runs.push(this._body(`• ${takeaway}`)));
    }

    if (!talk.note) {
      runs.push(this._muted('No notes for this one.', 6));
    }

    return runs;
  }

  private _talkCard(talk: IRecapPdfTalk): void {
    const padding = pdfLayout.CARD_PADDING;
    const badgeWidth = talk.quizTotal !== undefined ? 70 : 0;
    const textX = pdfLayout.MARGIN + padding + 6;
    const textWidth = contentWidth - padding * 2 - 6 - (badgeWidth > 0 ? badgeWidth + 10 : 0);
    const runs = this._talkRuns(talk);
    const height = Math.max(56, padding * 2 + this._runsHeight(runs, textWidth));
    this._ensure(height + pdfLayout.CARD_GAP, 'Talks you attended');
    const top = this._top;
    this._block(pdfLayout.MARGIN, top, contentWidth, height, pdfColors.CARD);
    this._rect(pdfLayout.MARGIN, top, 6, height, pdfColors.SKY_DEEP);
    this._drawRuns(runs, textX, top + padding, textWidth);

    if (talk.quizTotal !== undefined) {
      const badgeX = pdfLayout.MARGIN + contentWidth - padding - badgeWidth;
      this._block(badgeX, top + padding, badgeWidth, 36, pdfColors.GOLD, 3);
      this._centered('QUIZ', top + padding + 13, this._fonts.pixelBold, 8, pdfColors.INK, badgeX + badgeWidth / 2);
      this._centered(`${talk.quizCorrect ?? 0}/${talk.quizTotal}`, top + padding + 29, this._fonts.pixelBold, 14, pdfColors.INK, badgeX + badgeWidth / 2);
    }

    this._top = top + height + pdfLayout.CARD_GAP;
  }

  private _talksSection(): void {
    this._newPage('Talks you attended');

    if (this._data.talks.length === 0) {
      this._emptyCard('No talks yet. Scan a room code during a session to log it.', 'Talks you attended');

      return;
    }

    for (const talk of this._data.talks) {
      this._talkCard(talk);
    }
  }

  private _boothCard(booth: IRecapBooth): void {
    const padding = pdfLayout.CARD_PADDING;
    const textX = pdfLayout.MARGIN + padding + 6;
    const badge = booth.followUp ? 'FOLLOW UP' : '';
    const badgeWidth = badge ? this._width(badge, this._fonts.pixelBold, 8) + 16 : 0;
    const textWidth = contentWidth - padding * 2 - 6 - (badgeWidth > 0 ? badgeWidth + 10 : 0);
    const runs: ITextRun[] = [
      { text: booth.boothNumber ? `${booth.name} · Booth ${booth.boothNumber}` : booth.name, font: this._fonts.bold, size: 12, color: pdfColors.INK, gapBefore: 0 },
      ...(booth.liked.trim() !== '' ? [this._label('What I liked'), this._body(booth.liked)] : []),
      ...(booth.thoughts ? [this._label('Thoughts'), this._body(booth.thoughts)] : []),
      { text: `Next: ${booth.nextStep}`, font: this._fonts.bold, size: pdfLayout.SMALL_SIZE, color: pdfColors.GRASS_DARK, gapBefore: 8 },
    ];
    const height = padding * 2 + this._runsHeight(runs, textWidth);
    this._ensure(height + pdfLayout.CARD_GAP, 'Booths you visited');
    const top = this._top;
    this._block(pdfLayout.MARGIN, top, contentWidth, height, pdfColors.CARD);
    this._rect(pdfLayout.MARGIN, top, 6, height, pdfColors.DIRT);
    this._drawRuns(runs, textX, top + padding, textWidth);

    if (badge) {
      const badgeX = pdfLayout.MARGIN + contentWidth - padding - badgeWidth;
      this._block(badgeX, top + padding, badgeWidth, 20, pdfColors.GOLD, 2);
      this._text(badge, badgeX + 8, top + padding + 14, this._fonts.pixelBold, 8, pdfColors.INK);
    }

    this._top = top + height + pdfLayout.CARD_GAP;
  }

  private _boothsSection(): void {
    this._newPage('Booths you visited');

    if (this._data.booths.length === 0) {
      this._emptyCard('No booth notes yet. Scan a sponsor booth code and jot down what you liked.', 'Booths you visited');

      return;
    }

    for (const booth of this._data.booths) {
      this._boothCard(booth);
    }
  }

  private _itinerarySection(): void {
    if (this._data.itinerary.length === 0) {
      return;
    }

    this._newPage('Your itinerary');

    for (const item of this._data.itinerary) {
      const meta = [formatWhen(item.when) || item.when, item.where].filter((part): part is string => !!part).join(' · ');
      const runs: ITextRun[] = [{ text: item.title, font: this._fonts.bold, size: 11, color: pdfColors.INK, gapBefore: 0 }, ...(meta ? [this._muted(meta)] : [])];
      const height = pdfLayout.CARD_PADDING * 2 + this._runsHeight(runs, contentWidth - 40);
      this._ensure(height + 10, 'Your itinerary');
      this._block(pdfLayout.MARGIN, this._top, contentWidth, height, pdfColors.CARD, 3);
      this._rect(pdfLayout.MARGIN + 12, this._top + height / 2 - 5, 10, 10, pdfColors.GRASS);
      this._drawRuns(runs, pdfLayout.MARGIN + 32, this._top + pdfLayout.CARD_PADDING, contentWidth - 40);
      this._top += height + 10;
    }
  }

  private _nextStepsSection(): void {
    if (this._data.nextSteps.length === 0) {
      return;
    }

    const title = 'Your next steps';
    const rows = this._data.nextSteps.map((step) => this._wrap(step, this._fonts.body, pdfLayout.BODY_SIZE, contentWidth - 60));
    const height = pdfLayout.CARD_PADDING * 2 + rows.reduce((sum, lines) => sum + lines.length * (pdfLayout.BODY_SIZE + pdfLayout.LINE_GAP) + 8, 0);

    if (this._top + height + 40 > pdfLayout.PAGE_HEIGHT - pdfLayout.FOOTER_HEIGHT) {
      this._newPage(title);
    } else {
      this._top += 8;
      this._text(title.toUpperCase(), pdfLayout.MARGIN, this._top + 14, this._fonts.pixelBold, 16, pdfColors.GRASS_DARK);
      this._top += 28;
    }

    this._block(pdfLayout.MARGIN, this._top, contentWidth, height, pdfColors.CARD);
    let cursor = this._top + pdfLayout.CARD_PADDING;
    rows.forEach((lines, index) => {
      this._rect(pdfLayout.MARGIN + pdfLayout.CARD_PADDING, cursor, 18, 18, pdfColors.GRASS, pdfColors.INK, 1);
      this._centered(`${index + 1}`, cursor + 13, this._fonts.pixelBold, 9, pdfColors.CLOUD, pdfLayout.MARGIN + pdfLayout.CARD_PADDING + 9);
      lines.forEach((line) => {
        cursor += pdfLayout.BODY_SIZE;
        this._text(line, pdfLayout.MARGIN + pdfLayout.CARD_PADDING + 30, cursor + 2, this._fonts.body, pdfLayout.BODY_SIZE, pdfColors.INK);
        cursor += pdfLayout.LINE_GAP;
      });
      cursor += 8;
    });
    this._top += height + pdfLayout.CARD_GAP;
  }
}

export async function renderRecapPdf(data: IRecapPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`KubeQuest recap: @${data.player.handle}`);
  doc.setAuthor('KubeQuest');
  doc.setSubject(pdfText.CONFERENCE);
  doc.setCreationDate(new Date(data.generatedAt));
  const fonts = await loadFonts(doc);
  new RecapPdfWriter(doc, fonts, data).render();

  return doc.save();
}

export async function buildRecapPdf(attendeeId: string): Promise<Uint8Array> {
  return tracer.startActiveSpan('recap.pdf', async (span) => {
    try {
      const data = await loadRecapPdfData(attendeeId);
      const bytes = await renderRecapPdf(data);
      span.setAttributes({
        'kubequest.recap.people': data.connections.length,
        'kubequest.recap.talks': data.talks.length,
        'kubequest.recap.booths': data.booths.length,
        'kubequest.recap.pdf_bytes': bytes.length,
      });

      return bytes;
    } finally {
      span.end();
    }
  });
}
