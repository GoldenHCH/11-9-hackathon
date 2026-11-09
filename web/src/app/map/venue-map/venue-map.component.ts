import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { VenueService } from '../services/venue.service';
import { VenueSchematicComponent } from '../venue-schematic/venue-schematic.component';
import { venueAreaKindDisplay } from '../venue.constants';
import { VenueHelper } from '../venue.helper';
import { IVendor, IVenueArea, IVenueBuilding, IVenueLevel, IVenueSchematic } from '../venue.interfaces';
import { VenueAreaKind, VenueMapViewMode } from '../venue.types';

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

  @ViewChild('mapTop') private readonly _mapTop?: ElementRef<HTMLElement>;

  public readonly kindDisplay = venueAreaKindDisplay;
  public schematic: IVenueSchematic | null = null;
  public isLoading = true;
  public errorMessage = '';
  public viewMode: VenueMapViewMode = 'map';
  public selectedBuildingId = '';
  public selectedLevelId = '';
  public selectedAreaId: string | null = null;
  public highlightedVendor: IVendor | null = null;
  public vendorQuery = '';

  public ngOnInit(): void {
    this.loadSchematic();
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
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Venue schematic failed to load', error);
          this.errorMessage = 'The venue map didn’t load. Check your connection and try again.';
          this.isLoading = false;
        },
      });
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

  public selectLevel(levelId: string): void {
    this.selectedLevelId = levelId;
    this.selectedAreaId = null;
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
    this._mapTop?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  public vendorLocationLabel(vendor: IVendor): string {
    const area = vendor.areaId && this.schematic ? VenueHelper.findArea(this.schematic, vendor.areaId)?.area : null;
    const areaName = area ? (area.shortLabel ?? area.name) : '';

    return [areaName, vendor.zone].filter(Boolean).join(' · ');
  }
}
