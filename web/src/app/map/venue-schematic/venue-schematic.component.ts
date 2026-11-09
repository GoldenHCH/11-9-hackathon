import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { vendorTierFill, venueAreaKindDisplay } from '../venue.constants';
import { IVendor, IVenueArea, IVenueLevel, IVenuePoint, IVenueRect } from '../venue.interfaces';

const glyphWidthRatio = 0.78;
const lineHeightRatio = 1.25;
const minScale = 1;
const maxScale = 8;
const buttonZoomStep = 1.6;
const doubleZoomStep = 2;
const focusScale = 3.2;
const keyboardPanPx = 80;
const dragThresholdPx = 6;
const doubleTapMs = 320;
const doubleTapDistancePx = 32;
const animationMs = 260;
const wheelZoomRate = 0.0018;
const pinchWheelZoomRate = 0.012;
const lineDeltaPx = 16;
const defaultBoothSize = 8;
const boothNumberMinSize = 15;

interface IAreaLabel {
  lines: string[];
  fontSize: number;
  x: number;
  y: number;
}

interface IViewTransform {
  scale: number;
  x: number;
  y: number;
}

interface IGesture {
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  pinchDistance: number;
  pinchMidX: number;
  pinchMidY: number;
  moved: boolean;
}

@Component({
  selector: 'app-venue-schematic',
  imports: [MatIconModule],
  templateUrl: './venue-schematic.component.html',
  styleUrl: './venue-schematic.component.scss',
})
export class VenueSchematicComponent implements OnChanges, AfterViewInit, OnDestroy {
  private readonly _zone = inject(NgZone);

  @Input({ required: true }) public level!: IVenueLevel;
  @Input() public selectedAreaId: string | null = null;
  @Input() public highlightedAreaIds: string[] = [];
  @Input() public booths: IVendor[] = [];
  @Input() public highlightedVendorId: string | null = null;
  @Input() public areaTags: Record<string, string> = {};
  @Input() public liveAreaIds: string[] = [];
  @Output() public readonly areaSelected = new EventEmitter<IVenueArea>();
  @Output() public readonly boothSelected = new EventEmitter<IVendor>();

  @ViewChild('viewport', { static: true }) private readonly _viewport!: ElementRef<HTMLElement>;

  public readonly kindDisplay = venueAreaKindDisplay;
  public readonly tierFill = vendorTierFill;
  public view: IViewTransform = { scale: minScale, x: 0, y: 0 };
  public isDragging = false;
  public orderedAreas: IVenueArea[] = [];
  private _labels = new Map<string, IAreaLabel>();
  private readonly _pointers = new Map<number, IVenuePoint>();
  private _gesture: IGesture | null = null;
  private _suppressClick = false;
  private _lastTap: { time: number; x: number; y: number } | null = null;
  private _lastTouchAt = 0;
  private _animationFrame = 0;

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['level']) {
      this.orderedAreas = [...this.level.areas].sort(
        (first, second) => second.shape.width * second.shape.height - first.shape.width * first.shape.height,
      );
      this._labels = new Map(this.level.areas.map((area) => [area.id, this.buildLabel(area)]));

      if (!changes['level'].firstChange) {
        this.resetView(false);
      }
    }
  }

  public ngAfterViewInit(): void {
    this._viewport.nativeElement.addEventListener('click', this._clickCapture, { capture: true });
  }

  public ngOnDestroy(): void {
    cancelAnimationFrame(this._animationFrame);
    this._viewport.nativeElement.removeEventListener('click', this._clickCapture, { capture: true });
  }

  public get viewBox(): string {
    const pad = this.pad;

    return `${-pad} ${-pad} ${this.level.width + pad * 2} ${this.level.height + pad * 2}`;
  }

  public get aspectRatio(): string {
    return `${this.level.width + this.pad * 2} / ${this.level.height + this.pad * 2}`;
  }

  public get stageTransform(): string {
    return `translate(${this.view.x}px, ${this.view.y}px) scale(${this.view.scale})`;
  }

  public get zoomLabel(): string {
    return `${this.view.scale.toFixed(this.view.scale < 10 ? 1 : 0)}x`;
  }

  public get pad(): number {
    return this.unit * 16;
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
    return this.view.scale < maxScale - 0.01;
  }

  public get canZoomOut(): boolean {
    return this.view.scale > minScale + 0.01;
  }

  public zoomIn(): void {
    this.zoomAroundCenter(buttonZoomStep);
  }

  public zoomOut(): void {
    this.zoomAroundCenter(1 / buttonZoomStep);
  }

  public resetView(animate = true): void {
    this.setView({ scale: minScale, x: 0, y: 0 }, animate);
  }

  public focusPoint(point: IVenuePoint, scale = focusScale): void {
    const size = this.viewportSize();
    const base = this.toBasePixels(point);
    const nextScale = Math.max(this.view.scale, scale);

    this.setView({ scale: nextScale, x: size.width / 2 - base.x * nextScale, y: size.height / 2 - base.y * nextScale }, true);
  }

  public focusArea(areaId: string): void {
    const area = this.level.areas.find((candidate) => candidate.id === areaId);

    if (!area) {
      return;
    }

    const size = this.viewportSize();
    const corner = this.toBasePixels({ x: area.shape.x, y: area.shape.y });
    const farCorner = this.toBasePixels({ x: area.shape.x + area.shape.width, y: area.shape.y + area.shape.height });
    const fit = Math.min(
      size.width / Math.max(1, (farCorner.x - corner.x) * 1.6),
      size.height / Math.max(1, (farCorner.y - corner.y) * 1.6),
    );

    this.focusPoint(area.labelAt ?? this.centroid(area), Math.min(focusScale, Math.max(minScale, fit)));
  }

  public focusVendor(vendor: IVendor): void {
    if (vendor.position && vendor.levelId === this.level.id) {
      this.focusPoint(vendor.position);

      return;
    }

    if (vendor.areaId) {
      this.focusArea(vendor.areaId);
    }
  }

  public onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaMode === 1 ? event.deltaY * lineDeltaPx : event.deltaY;
    const rate = event.ctrlKey ? pinchWheelZoomRate : wheelZoomRate;
    const point = this.localPoint(event);

    this.setView(this.zoomedAt(this.view, Math.exp(-delta * rate), point), false);
  }

  public onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    if (event.pointerType === 'touch') {
      this._lastTouchAt = Date.now();
    }

    const point = this.localPoint(event);
    this._pointers.set(event.pointerId, point);
    cancelAnimationFrame(this._animationFrame);

    if (this._pointers.size === 1) {
      this._suppressClick = false;
      this._gesture = { startX: point.x, startY: point.y, lastX: point.x, lastY: point.y, pinchDistance: 0, pinchMidX: 0, pinchMidY: 0, moved: false };
    } else if (this._pointers.size === 2 && this._gesture) {
      const [first, second] = [...this._pointers.values()];
      this._gesture.pinchDistance = Math.hypot(second.x - first.x, second.y - first.y);
      this._gesture.pinchMidX = (first.x + second.x) / 2;
      this._gesture.pinchMidY = (first.y + second.y) / 2;
      this._gesture.moved = true;
      this.capture(event);
    }
  }

  public onPointerMove(event: PointerEvent): void {
    if (!this._pointers.has(event.pointerId) || !this._gesture) {
      return;
    }

    const point = this.localPoint(event);
    this._pointers.set(event.pointerId, point);
    const gesture = this._gesture;

    if (this._pointers.size >= 2) {
      const [first, second] = [...this._pointers.values()];
      const distance = Math.hypot(second.x - first.x, second.y - first.y);
      const midX = (first.x + second.x) / 2;
      const midY = (first.y + second.y) / 2;
      const ratio = gesture.pinchDistance > 0 ? distance / gesture.pinchDistance : 1;
      const zoomed = this.zoomedAt(this.view, ratio, { x: midX, y: midY });

      this.setView({ ...zoomed, x: zoomed.x + midX - gesture.pinchMidX, y: zoomed.y + midY - gesture.pinchMidY }, false);
      gesture.pinchDistance = distance;
      gesture.pinchMidX = midX;
      gesture.pinchMidY = midY;

      return;
    }

    if (!gesture.moved && Math.hypot(point.x - gesture.startX, point.y - gesture.startY) < dragThresholdPx) {
      return;
    }

    if (!gesture.moved) {
      gesture.moved = true;
      this.isDragging = true;
      this.capture(event);
    }

    this.setView({ ...this.view, x: this.view.x + point.x - gesture.lastX, y: this.view.y + point.y - gesture.lastY }, false);
    gesture.lastX = point.x;
    gesture.lastY = point.y;
  }

  public onPointerUp(event: PointerEvent): void {
    if (!this._pointers.has(event.pointerId)) {
      return;
    }

    const point = this.localPoint(event);
    this._pointers.delete(event.pointerId);
    const gesture = this._gesture;

    if (this._pointers.size === 1 && gesture) {
      const [remaining] = [...this._pointers.values()];
      gesture.lastX = remaining.x;
      gesture.lastY = remaining.y;

      return;
    }

    if (this._pointers.size > 0) {
      return;
    }

    this.isDragging = false;
    this._gesture = null;

    if (gesture?.moved) {
      this._suppressClick = true;
      this._lastTap = null;

      return;
    }

    if (event.pointerType === 'touch' && event.type === 'pointerup') {
      this.handleTap(point);
    }
  }

  private readonly _clickCapture = (event: MouseEvent): void => {
    if (this._suppressClick) {
      event.stopPropagation();
      event.preventDefault();
      this._suppressClick = false;
    }
  };

  public onDoubleClick(event: MouseEvent): void {
    event.preventDefault();

    if (Date.now() - this._lastTouchAt < 800) {
      return;
    }

    this.setView(this.zoomedAt(this.view, doubleZoomStep, this.localPoint(event)), true);
  }

  public onKeydown(event: KeyboardEvent): void {
    const moves: Record<string, IVenuePoint> = {
      ArrowLeft: { x: keyboardPanPx, y: 0 },
      ArrowRight: { x: -keyboardPanPx, y: 0 },
      ArrowUp: { x: 0, y: keyboardPanPx },
      ArrowDown: { x: 0, y: -keyboardPanPx },
    };
    const move = moves[event.key];

    if (move) {
      event.preventDefault();
      this.setView({ ...this.view, x: this.view.x + move.x, y: this.view.y + move.y }, true);

      return;
    }

    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      this.zoomOut();
    } else if (event.key === '0') {
      event.preventDefault();
      this.resetView();
    }
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

  public isLive(area: IVenueArea): boolean {
    return this.liveAreaIds.includes(area.id);
  }

  public tagFor(area: IVenueArea): string {
    return this.areaTags[area.id] ?? '';
  }

  public tagSize(label: IAreaLabel): number {
    return Math.max(this.unit * 6, label.fontSize * 0.62);
  }

  public tagY(label: IAreaLabel): number {
    return label.y + (label.lines.length / 2) * label.fontSize * lineHeightRatio + this.tagSize(label) * 0.9;
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
    return (this.unit * 15) / Math.sqrt(this.view.scale);
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
      event.stopPropagation();
      this.areaSelected.emit(area);
    }
  }

  public onBoothClick(event: MouseEvent, booth: IVendor): void {
    event.stopPropagation();
    this.boothSelected.emit(booth);
  }

  private handleTap(point: IVenuePoint): void {
    const now = Date.now();
    const lastTap = this._lastTap;

    if (lastTap && now - lastTap.time < doubleTapMs && Math.hypot(point.x - lastTap.x, point.y - lastTap.y) < doubleTapDistancePx) {
      this._lastTap = null;
      this.setView(this.zoomedAt(this.view, doubleZoomStep, point), true);

      return;
    }

    this._lastTap = { time: now, x: point.x, y: point.y };
  }

  private capture(event: PointerEvent): void {
    try {
      this._viewport.nativeElement.setPointerCapture(event.pointerId);
    } catch {
      this._suppressClick = true;
    }
  }

  private zoomAroundCenter(factor: number): void {
    const size = this.viewportSize();

    this.setView(this.zoomedAt(this.view, factor, { x: size.width / 2, y: size.height / 2 }), true);
  }

  private zoomedAt(view: IViewTransform, factor: number, point: IVenuePoint): IViewTransform {
    const scale = Math.min(maxScale, Math.max(minScale, view.scale * factor));
    const ratio = scale / view.scale;

    return { scale, x: point.x - (point.x - view.x) * ratio, y: point.y - (point.y - view.y) * ratio };
  }

  private clamp(view: IViewTransform): IViewTransform {
    const size = this.viewportSize();
    const scale = Math.min(maxScale, Math.max(minScale, view.scale));
    const minX = size.width - size.width * scale;
    const minY = size.height - size.height * scale;

    return { scale, x: Math.min(0, Math.max(minX, view.x)), y: Math.min(0, Math.max(minY, view.y)) };
  }

  private setView(target: IViewTransform, animate: boolean): void {
    cancelAnimationFrame(this._animationFrame);
    const next = this.clamp(target);

    if (!animate || this.prefersReducedMotion()) {
      this.view = next;

      return;
    }

    const start = { ...this.view };
    const startedAt = performance.now();
    const step = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / animationMs);
      const eased = 1 - Math.pow(1 - progress, 3);

      this._zone.run(() => {
        this.view = {
          scale: start.scale + (next.scale - start.scale) * eased,
          x: start.x + (next.x - start.x) * eased,
          y: start.y + (next.y - start.y) * eased,
        };
      });

      if (progress < 1) {
        this._animationFrame = requestAnimationFrame(step);
      }
    };

    this._animationFrame = requestAnimationFrame(step);
  }

  private prefersReducedMotion(): boolean {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private viewportSize(): { width: number; height: number } {
    const rect = this._viewport.nativeElement.getBoundingClientRect();

    return { width: rect.width || 1, height: rect.height || 1 };
  }

  private localPoint(event: MouseEvent): IVenuePoint {
    const rect = this._viewport.nativeElement.getBoundingClientRect();

    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private toBasePixels(point: IVenuePoint): IVenuePoint {
    const size = this.viewportSize();
    const pad = this.pad;
    const boxWidth = this.level.width + pad * 2;
    const boxHeight = this.level.height + pad * 2;
    const ratio = Math.min(size.width / boxWidth, size.height / boxHeight);
    const offsetX = (size.width - boxWidth * ratio) / 2;
    const offsetY = (size.height - boxHeight * ratio) / 2;

    return { x: offsetX + (point.x + pad) * ratio, y: offsetY + (point.y + pad) * ratio };
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
