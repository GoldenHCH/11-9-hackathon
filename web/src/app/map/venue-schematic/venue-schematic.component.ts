import { Component, EventEmitter, Input, Output } from '@angular/core';
import { vendorTierFill, venueAreaKindDisplay } from '../venue.constants';
import { IVendor, IVenueArea, IVenueLevel, IVenueRect } from '../venue.interfaces';

const maxLabelFontSize = 26;
const minLabelFontSize = 10;
const averageGlyphWidthRatio = 0.62;
const defaultBoothSize = 10;
const calloutHeight = 22;

@Component({
  selector: 'app-venue-schematic',
  templateUrl: './venue-schematic.component.html',
  styleUrl: './venue-schematic.component.scss',
})
export class VenueSchematicComponent {
  @Input({ required: true }) public level!: IVenueLevel;
  @Input() public buildingName = '';
  @Input() public selectedAreaId: string | null = null;
  @Input() public highlightedAreaIds: string[] = [];
  @Input() public booths: IVendor[] = [];
  @Input() public highlightedVendorId: string | null = null;
  @Output() public readonly areaSelected = new EventEmitter<IVenueArea>();
  @Output() public readonly boothSelected = new EventEmitter<IVendor>();

  public readonly kindDisplay = venueAreaKindDisplay;
  public readonly tierFill = vendorTierFill;

  public get viewBox(): string {
    return `0 0 ${this.level.width} ${this.level.height}`;
  }

  public get boothSize(): number {
    return this.level.boothSize ?? defaultBoothSize;
  }

  public get orderedAreas(): IVenueArea[] {
    return [...this.level.areas].sort(
      (first, second) => second.shape.width * second.shape.height - first.shape.width * first.shape.height,
    );
  }

  public get highlightedBooth(): IVendor | null {
    return this.booths.find((booth) => booth.id === this.highlightedVendorId) ?? null;
  }

  public get hasBooths(): boolean {
    return this.booths.length > 0;
  }

  public labelFor(area: IVenueArea): string {
    return area.shortLabel ?? area.name;
  }

  public labelFontSize(area: IVenueArea): number {
    const label = this.labelFor(area);
    const fittedSize = (area.shape.width - 8) / (label.length * averageGlyphWidthRatio);
    const scaledMax = this.hasBooths ? maxLabelFontSize / 2 : maxLabelFontSize;
    const scaledMin = this.hasBooths ? minLabelFontSize / 1.6 : minLabelFontSize;

    return Math.max(scaledMin, Math.min(scaledMax, fittedSize, area.shape.height / 2));
  }

  public labelY(area: IVenueArea): number {
    if (this.hasBooths && area.kind === 'showcase') {
      return area.shape.y + this.labelFontSize(area);
    }

    return area.shape.y + area.shape.height / 2;
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

  public boothRect(booth: IVendor): IVenueRect {
    const size = booth.id === this.highlightedVendorId ? this.boothSize * 1.8 : this.boothSize;

    return {
      x: (booth.position?.x ?? 0) - size / 2,
      y: (booth.position?.y ?? 0) - size / 2,
      width: size,
      height: size,
    };
  }

  public calloutText(booth: IVendor): string {
    return `${booth.booth} · ${booth.name}`;
  }

  public calloutRect(booth: IVendor): IVenueRect {
    const width = Math.min(this.level.width - 8, this.calloutText(booth).length * 7.4 + 16);
    const anchorX = booth.position?.x ?? 0;
    const anchorY = booth.position?.y ?? 0;
    const x = Math.min(Math.max(4, anchorX - width / 2), this.level.width - width - 4);
    const placeAbove = anchorY - this.boothSize * 2 - calloutHeight > 0;
    const y = placeAbove ? anchorY - this.boothSize * 1.4 - calloutHeight : anchorY + this.boothSize * 1.4;

    return { x, y, width, height: calloutHeight };
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
}
