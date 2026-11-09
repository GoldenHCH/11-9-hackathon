import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ILocation } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { ISchedule, IScheduleSession } from '../../itinerary/itinerary.types';
import { BoothPhotosComponent } from '../../photos/booth-photos/booth-photos.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { DemoScanPickerComponent } from '../demo-scan-picker/demo-scan-picker.component';
import { DemoScanHelper } from '../demo-scan.helper';
import { NowNextBarComponent } from '../now-next-bar/now-next-bar.component';
import { RoomSessionCardComponent } from '../room-session-card/room-session-card.component';
import { IRoomSessions, RoomSessionsHelper } from '../room-sessions.helper';
import { DemoScanService } from '../services/demo-scan.service';
import { VenueService } from '../services/venue.service';
import { VenueSchematicComponent } from '../venue-schematic/venue-schematic.component';
import { vendorTierFill, vendorTierOrder, venueAreaKindDisplay } from '../venue.constants';
import { VenueHelper } from '../venue.helper';
import { IVendor, IVenueArea, IVenueBuilding, IVenueLevel, IVenueSchematic } from '../venue.interfaces';
import { VendorTier, VenueAreaKind, VenueMapViewMode } from '../venue.types';

const maxVendorResults = 40;

@Component({
  selector: 'app-venue-map',
  imports: [
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    BoothPhotosComponent,
    DemoScanPickerComponent,
    NowNextBarComponent,
    RoomSessionCardComponent,
    ScreenToolbarComponent,
    StateWrapperComponent,
    VenueSchematicComponent,
  ],
  templateUrl: './venue-map.component.html',
  styleUrl: './venue-map.component.scss',
})
export class VenueMapComponent implements OnInit {
  private readonly _venueService = inject(VenueService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _route = inject(ActivatedRoute);
  private readonly _demoScanService = inject(DemoScanService);
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private _schedule: ISchedule | null = null;
  private _focusApplied = false;

  @ViewChild('mapTop') private readonly _mapTop?: ElementRef<HTMLElement>;
  @ViewChild(VenueSchematicComponent) private readonly _schematic?: VenueSchematicComponent;

  public readonly kindDisplay = venueAreaKindDisplay;
  public readonly tierFill = vendorTierFill;
  public schematic: IVenueSchematic | null = null;
  public isLoading = true;
  public errorMessage = '';
  public viewMode: VenueMapViewMode = 'map';
  public selectedBuildingId = '';
  public selectedLevelId = '';
  public selectedAreaId: string | null = null;
  public highlightedVendor: IVendor | null = null;
  public vendorQuery = '';
  public demoScansEnabled = false;
  public demoLocations: ILocation[] = [];
  public isDemoPickerOpen = false;
  public isLoadingDemoLocations = false;
  public pendingDemoLocationId: string | null = null;
  public demoScanError = '';
  public readonly noTags: Record<string, string> = {};
  public readonly noAreaIds: string[] = [];
  public showNowNext = false;
  public roomSessions = new Map<string, IRoomSessions>();
  public nowNextTags: Record<string, string> = {};
  public liveAreaIds: string[] = [];
  public liveSessions: IScheduleSession[] = [];
  public scheduleDay = '';
  public isScheduleLoading = false;
  public scheduleError = '';

  public ngOnInit(): void {
    this.loadSchematic();
    this.loadDemoLocations();
    this.loadRoomSchedule();
    this._demoScanService
      .isEnabled()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((enabled) => {
        this.demoScansEnabled = enabled;
      });
  }

  public get highlightedVendorPhotoLocationId(): string | null {
    return this.highlightedVendorDemoLocations[0]?.id ?? null;
  }

  public get selectedAreaDemoLocations(): ILocation[] {
    const area = this.selectedArea;

    return area ? DemoScanHelper.forArea(area, this.demoLocations) : [];
  }

  public get highlightedVendorDemoLocations(): ILocation[] {
    return this.highlightedVendor ? DemoScanHelper.forVendor(this.highlightedVendor, this.demoLocations) : [];
  }

  public openDemoPicker(): void {
    this.demoScanError = '';
    this.isDemoPickerOpen = true;

    if (!this.demoLocations.length) {
      this.loadDemoLocations();
    }
  }

  public closeDemoPicker(): void {
    this.isDemoPickerOpen = false;
    this.demoScanError = '';
  }

  public simulateScan(location: ILocation): void {
    if (this.pendingDemoLocationId) {
      return;
    }

    this.pendingDemoLocationId = location.id;
    this.demoScanError = '';
    this._demoScanService
      .simulate(location.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.pendingDemoLocationId = null;
        },
        error: (error: unknown) => {
          console.error('Simulated scan failed', error);
          this.demoScanError = ApiErrorHelper.message(error);
          this.pendingDemoLocationId = null;
        },
      });
  }

  private loadDemoLocations(): void {
    this.isLoadingDemoLocations = true;
    this._demoScanService
      .getLocations()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (locations) => {
          this.demoLocations = locations;
          this.isLoadingDemoLocations = false;
          this.applyFocus();
        },
        error: (error: unknown) => {
          console.error('Game locations failed to load', error);
          this.demoScanError = ApiErrorHelper.message(error);
          this.isLoadingDemoLocations = false;
        },
      });
  }

  public loadSchematic(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._venueService.reset();
    this._venueService
      .getSchematic()
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (schematic) => {
          this.schematic = schematic;
          this.selectBuilding(schematic.buildings[0]?.id ?? '');
          this.openRequestedLevel(schematic);
          this.isLoading = false;
          this.indexRoomSessions();
          this.applyFocus();
        },
        error: (error: unknown) => {
          console.error('Venue schematic failed to load', error);
          this.errorMessage = 'The venue map didn’t load. Check your connection and try again.';
          this.isLoading = false;
        },
      });
  }

  public get selectedAreaSessions(): IRoomSessions | null {
    return this.selectedAreaId ? (this.roomSessions.get(this.selectedAreaId) ?? null) : null;
  }

  public toggleNowNext(): void {
    this.showNowNext = !this.showNowNext;

    if (this.showNowNext && !this._schedule && !this.isScheduleLoading) {
      this.loadRoomSchedule();
    }
  }

  public loadRoomSchedule(): void {
    this.isScheduleLoading = true;
    this.scheduleError = '';
    const attendeeId = this._meService.attendeeId;
    this._toolsService
      .call<ISchedule>('list_schedule', attendeeId ? { attendeeId } : {}, { background: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (schedule) => {
          this._schedule = schedule;
          this.scheduleDay = schedule.day;
          this.isScheduleLoading = false;
          this.indexRoomSessions();
          this.applyFocus();
        },
        error: (error: unknown) => {
          console.error('list_schedule failed', error);
          this.scheduleError = ApiErrorHelper.message(error);
          this.isScheduleLoading = false;
        },
      });
  }

  private indexRoomSessions(): void {
    if (!this.schematic || !this._schedule) {
      return;
    }

    this.roomSessions = RoomSessionsHelper.byArea(this.schematic, this._schedule);
    const tags: Record<string, string> = {};
    const live: string[] = [];

    for (const [areaId, entry] of this.roomSessions) {
      tags[areaId] = RoomSessionsHelper.tag(entry);

      if (entry.now) {
        live.push(areaId);
      }
    }

    this.nowNextTags = tags;
    this.liveAreaIds = live;
    this.liveSessions = RoomSessionsHelper.liveSessions(this._schedule).slice(0, 4);
  }

  private applyFocus(): void {
    const focusId = this._route.snapshot.queryParamMap.get('focus');

    if (this._focusApplied || !focusId || !this.schematic) {
      return;
    }

    const session = this._schedule?.slots.flatMap((slot) => slot.sessions).find((candidate) => candidate.locationId === focusId);
    const location =
      this.demoLocations.find((candidate) => candidate.id === focusId) ?? (session ? RoomSessionsHelper.locationFromSession(session) : null);

    if (!location) {
      return;
    }

    if (location.kind === 'outpost') {
      const vendor = this.schematic.vendors.find((candidate) => DemoScanHelper.forVendor(candidate, [location]).length > 0);

      if (vendor) {
        this._focusApplied = true;
        this.showVendorOnMap(vendor);

        return;
      }
    }

    if (this.focusLocation(location)) {
      this._focusApplied = true;
    }
  }

  public focusSession(session: IScheduleSession): void {
    this.focusLocation(this.demoLocations.find((candidate) => candidate.id === session.locationId) ?? RoomSessionsHelper.locationFromSession(session));
  }

  private focusLocation(location: ILocation): boolean {
    const focus = this.schematic ? RoomSessionsHelper.findFocus(this.schematic, location) : null;

    if (!focus) {
      return false;
    }

    this.viewMode = 'map';
    this.goToLevel(focus.buildingId, focus.levelId);

    if (focus.areaId) {
      this.selectedAreaId = focus.areaId;
      setTimeout(() => this._schematic?.focusArea(focus.areaId), 60);
    }

    return true;
  }

  public get selectedBuilding(): IVenueBuilding | null {
    return this.schematic?.buildings.find((building) => building.id === this.selectedBuildingId) ?? null;
  }

  public get selectedLevel(): IVenueLevel | null {
    return this.selectedBuilding?.levels.find((level) => level.id === this.selectedLevelId) ?? null;
  }

  public get selectedArea(): IVenueArea | null {
    return this.selectedLevel?.areas.find((area) => area.id === this.selectedAreaId) ?? null;
  }

  public get selectedAreaVendors(): IVendor[] {
    if (!this.schematic || !this.selectedAreaId) {
      return [];
    }

    return VenueHelper.vendorsInArea(this.schematic.vendors, this.selectedAreaId);
  }

  public get legendKinds(): VenueAreaKind[] {
    const kinds = new Set((this.selectedLevel?.areas ?? []).map((area) => area.kind));

    return [...kinds];
  }

  public get vendorResults(): IVendor[] {
    return VenueHelper.searchVendors(this.schematic?.vendors ?? [], this.vendorQuery).slice(0, maxVendorResults);
  }

  public get vendorResultTotal(): number {
    return VenueHelper.searchVendors(this.schematic?.vendors ?? [], this.vendorQuery).length;
  }

  public get highlightedAreaIds(): string[] {
    return this.highlightedVendor?.areaId ? [this.highlightedVendor.areaId] : [];
  }

  public selectBuilding(buildingId: string): void {
    this.selectedBuildingId = buildingId;
    this.selectedLevelId = this.selectedBuilding?.levels[0]?.id ?? '';
    this.selectedAreaId = null;
  }

  private openRequestedLevel(schematic: IVenueSchematic): void {
    const requestedLevelId = this._route.snapshot.queryParamMap.get('level');
    const placement = requestedLevelId ? VenueHelper.findLevel(schematic, requestedLevelId) : null;

    if (placement) {
      this.goToLevel(placement.building.id, placement.level.id);
    }
  }

  public goToLevel(buildingId: string, levelId: string): void {
    this.selectedBuildingId = buildingId;
    this.selectedLevelId = levelId;
    this.selectedAreaId = null;
  }

  public get boothTiers(): VendorTier[] {
    const tiers = new Set(this.levelBooths.map((booth) => booth.tier));

    return [...tiers].sort((first, second) => vendorTierOrder[first] - vendorTierOrder[second]);
  }

  public selectArea(area: IVenueArea): void {
    this.selectedAreaId = this.selectedAreaId === area.id ? null : area.id;
  }

  public get levelBooths(): IVendor[] {
    if (!this.schematic || !this.selectedLevelId) {
      return [];
    }

    return VenueHelper.vendorsOnLevel(this.schematic.vendors, this.selectedLevelId);
  }

  public get connectedLevelLabel(): string {
    const targetLevelId = this.selectedArea?.connectsTo;

    if (!this.schematic || !targetLevelId) {
      return '';
    }

    const placement = VenueHelper.findLevel(this.schematic, targetLevelId);

    return placement ? `${placement.building.shortName}, ${placement.level.label}` : '';
  }

  public followConnection(): void {
    const targetLevelId = this.selectedArea?.connectsTo;

    if (!this.schematic || !targetLevelId) {
      return;
    }

    const placement = VenueHelper.findLevel(this.schematic, targetLevelId);

    if (!placement) {
      return;
    }

    this.selectedBuildingId = placement.building.id;
    this.selectedLevelId = placement.level.id;
    this.selectedAreaId = null;
  }

  public selectBooth(vendor: IVendor): void {
    this.highlightedVendor = vendor;
    this.selectedAreaId = vendor.areaId ?? null;
  }

  public clearHighlightedVendor(): void {
    this.highlightedVendor = null;
  }

  public showVendorOnMap(vendor: IVendor): void {
    this.highlightedVendor = vendor;

    if (!this.schematic || !vendor.areaId) {
      return;
    }

    const placement = VenueHelper.findArea(this.schematic, vendor.areaId);

    if (!placement) {
      return;
    }

    const boothLevel = vendor.levelId ? VenueHelper.findLevel(this.schematic, vendor.levelId) : null;
    this.viewMode = 'map';
    this.selectedBuildingId = (boothLevel ?? placement).building.id;
    this.selectedLevelId = (boothLevel ?? placement).level.id;
    this.selectedAreaId = placement.area.id;
    const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this._mapTop?.nativeElement.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    setTimeout(() => this._schematic?.focusVendor(vendor));
  }

  public vendorLocationLabel(vendor: IVendor): string {
    const area = vendor.areaId && this.schematic ? VenueHelper.findArea(this.schematic, vendor.areaId)?.area : null;
    const areaName = area ? (area.shortLabel ?? area.name) : '';

    return [vendor.hall, areaName && areaName !== vendor.zone ? areaName : vendor.zone].filter(Boolean).join(' · ');
  }
}
