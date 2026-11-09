import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { vendorTierFill, venueAreaKindDisplay } from '../venue.constants';
import { IVendor, IVenueArea, IVenueLevel, IVenuePoint, IVenueRect } from '../venue.interfaces';

const glyphWidthRatio = 0.78;
const lineHeightRatio = 1.25;
const minZoom = 1;
const maxZoom = 4;
const defaultBoothSize = 8;
const boothNumberMinSize = 15;

interface IAreaLabel {
  lines: string[];
  fontSize: number;
  x: number;
  y: number;
}

@Component({
  selector: 'app-venue-schematic',
  imports: [MatIconModule],
  templateUrl: './venue-schematic.component.html',
  styleUrl: './venue-schematic.component.scss',
})
export class VenueSchematicComponent implements OnChanges {
  @Input({ required: true }) public level!: IVenueLevel;
  @Input() public selectedAreaId: string | null = null;
  @Input() public highlightedAreaIds: string[] = [];
  @Input() public booths: IVendor[] = [];
  @Input() public highlightedVendorId: string | null = null;
  @Output() public readonly areaSelected = new EventEmitter<IVenueArea>();
  @Output() public readonly boothSelected = new EventEmitter<IVendor>();

  public readonly kindDisplay = venueAreaKindDisplay;
  public readonly tierFill = vendorTierFill;
  public zoom = minZoom;
  public orderedAreas: IVenueArea[] = [];
  private _labels = new Map<string, IAreaLabel>();

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['level']) {
      this.zoom = minZoom;
      this.orderedAreas = [...this.level.areas].sort(
        (first, second) => second.shape.width * second.shape.height - first.shape.width * first.shape.height,
      );
      this._labels = new Map(this.level.areas.map((area) => [area.id, this.buildLabel(area)]));
    }
  }

  public get viewBox(): string {
    const pad = this.unit * 16;

    return `${-pad} ${-pad} ${this.level.width + pad * 2} ${this.level.height + pad * 2}`;
  }

  public get unit(): number {
    return Math.max(this.level.width, this.level.height) / 1000;
  }

  public get depth(): number {
    return this.unit * 6;
  }

  public get outlinePoints(): string {
    return (this.level.outline ?? []).map((point) => `${point.x},${point.y}`).join(' ');
  }

  public get highlightedBooth(): IVendor | null {
    return this.booths.find((booth) => booth.id === this.highlightedVendorId) ?? null;
  }

  public get hasBooths(): boolean {
    return this.booths.length > 0;
  }

  public get canZoomIn(): boolean {
    return this.zoom < maxZoom;
  }

  public get canZoomOut(): boolean {
    return this.zoom > minZoom;
  }

  public zoomIn(): void {
    this.zoom = Math.min(maxZoom, this.zoom + 1);
  }

  public zoomOut(): void {
    this.zoom = Math.max(minZoom, this.zoom - 1);
  }

  public pointsFor(area: IVenueArea): string {
    return this.areaPoints(area)
      .map((point) => `${point.x},${point.y}`)
      .join(' ');
  }

  public fillFor(area: IVenueArea): string {
    return area.fill ?? this.kindDisplay[area.kind].fill;
  }

  public inkFor(area: IVenueArea): string {
    return area.fill ? '#1c1b22' : this.kindDisplay[area.kind].ink;
  }

  public labelFor(area: IVenueArea): IAreaLabel {
    return this._labels.get(area.id) ?? { lines: [], fontSize: 0, x: 0, y: 0 };
  }

  public lineDy(label: IAreaLabel, index: number): number {
    const lineHeight = label.fontSize * lineHeightRatio;

    return (index - (label.lines.length - 1) / 2) * lineHeight;
  }

  public isSelected(area: IVenueArea): boolean {
    return area.id === this.selectedAreaId;
  }

  public isHighlighted(area: IVenueArea): boolean {
    return this.highlightedAreaIds.includes(area.id);
  }

  public ariaLabelFor(area: IVenueArea): string {
    const kindLabel = this.kindDisplay[area.kind].label;
    const selectedSuffix = this.isSelected(area) ? ', selected' : '';

    return `${area.name}, ${kindLabel}${selectedSuffix}`;
  }

  public boothSizeFor(booth: IVendor): number {
    const size = booth.footprint?.size ?? defaultBoothSize * this.unit;

    return booth.id === this.highlightedVendorId ? Math.max(size * 1.6, this.unit * 14) : size;
  }

  public boothRect(booth: IVendor): IVenueRect {
    const size = this.boothSizeFor(booth);

    return {
      x: (booth.position?.x ?? 0) - size / 2,
      y: (booth.position?.y ?? 0) - size / 2,
      width: size,
      height: size,
    };
  }

  public boothTransform(booth: IVendor): string | null {
    if (!booth.footprint?.rotated) {
      return null;
    }

    return `rotate(45 ${booth.position?.x ?? 0} ${booth.position?.y ?? 0})`;
  }

  public showsBoothNumber(booth: IVendor): boolean {
    return (booth.footprint?.size ?? 0) >= boothNumberMinSize * this.unit && booth.kind === 'sponsor';
  }

  public calloutText(booth: IVendor): string {
    return `${booth.booth} · ${booth.name}`;
  }

  public get calloutFontSize(): number {
    return this.unit * 15;
  }

  public calloutRect(booth: IVendor): IVenueRect {
    const fontSize = this.calloutFontSize;
    const height = fontSize * 1.9;
    const width = Math.min(this.level.width, this.calloutText(booth).length * fontSize * 0.62 + fontSize * 1.4);
    const anchorX = booth.position?.x ?? 0;
    const anchorY = booth.position?.y ?? 0;
    const gap = this.boothSizeFor(booth);
    const x = Math.min(Math.max(0, anchorX - width / 2), this.level.width - width);
    const placeAbove = anchorY - gap - height > 0;
    const y = placeAbove ? anchorY - gap - height : anchorY + gap;

    return { x, y, width, height };
  }

  public onAreaKeydown(event: KeyboardEvent, area: IVenueArea): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.areaSelected.emit(area);
    }
  }

  public onBoothClick(event: MouseEvent, booth: IVendor): void {
    event.stopPropagation();
    this.boothSelected.emit(booth);
  }

  private areaPoints(area: IVenueArea): IVenuePoint[] {
    if (area.points?.length) {
      return area.points;
    }

    const { x, y, width, height } = area.shape;

    return [
      { x, y },
      { x: x + width, y },
      { x: x + width, y: y + height },
      { x, y: y + height },
    ];
  }

  private centroid(area: IVenueArea): IVenuePoint {
    const points = this.areaPoints(area);
    let signedArea = 0;
    let cx = 0;
    let cy = 0;

    points.forEach((point, index) => {
      const next = points[(index + 1) % points.length];
      const cross = point.x * next.y - next.x * point.y;
      signedArea += cross;
      cx += (point.x + next.x) * cross;
      cy += (point.y + next.y) * cross;
    });

    if (Math.abs(signedArea) < 1e-6) {
      return { x: area.shape.x + area.shape.width / 2, y: area.shape.y + area.shape.height / 2 };
    }

    return { x: cx / (3 * signedArea), y: cy / (3 * signedArea) };
  }

  private buildLabel(area: IVenueArea): IAreaLabel {
    const text = (area.shortLabel ?? area.name).toUpperCase();
    const center = area.labelAt ?? this.centroid(area);
    const isPolygon = !!area.points?.length;
    const width = area.shape.width * (isPolygon ? 0.55 : 0.9);
    const height = area.shape.height * (isPolygon ? 0.5 : 0.8);
    const maxSize = this.unit * (this.hasBoothsOnLevel() && area.kind === 'showcase' ? 13 : 22);
    const minSize = this.unit * 7;
    const words = text.split(' ');
    const candidates = [[text]];

    if (words.length > 1) {
      for (let split = 1; split < words.length; split++) {
        const lines = [words.slice(0, split).join(' '), words.slice(split).join(' ')].map((line) => line.replace(/^·\s*|\s*·$/g, ''));
        candidates.push(lines);
      }
    }

    let best: IAreaLabel = { lines: [text], fontSize: minSize, x: center.x, y: center.y };

    for (const lines of candidates) {
      const longest = Math.max(...lines.map((line) => line.length));
      const byWidth = width / (longest * glyphWidthRatio);
      const byHeight = height / (lines.length * lineHeightRatio);
      const size = Math.min(maxSize, byWidth, byHeight);

      if (size > best.fontSize) {
        best = { lines, fontSize: size, x: center.x, y: center.y };
      }
    }

    if (this.hasBoothsOnLevel() && area.kind === 'showcase') {
      return { ...best, lines: [], fontSize: 0 };
    }

    return best;
  }

  private hasBoothsOnLevel(): boolean {
    return !!this.level.boothScale;
  }
}
