import { VendorKind, VendorTier, VenueAreaKind } from './venue.types';

export interface IVenueRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IVenuePoint {
  x: number;
  y: number;
}

export interface IVenueArea {
  id: string;
  name: string;
  kind: VenueAreaKind;
  shape: IVenueRect;
  shortLabel?: string;
  description?: string;
  zone?: string;
  scheduleRooms?: string[];
  connectsTo?: string;
  inferred?: boolean;
  points?: IVenuePoint[];
  fill?: string;
  labelAt?: IVenuePoint;
}

export interface IVenueLabel {
  text: string;
  x: number;
  y: number;
  rotate?: number;
  tone?: 'zone';
}

export interface IVenueOfficialMap {
  label: string;
  url: string;
}

export interface IVendorFootprint {
  size: number;
  rotated: boolean;
}

export interface IVenueLevel {
  id: string;
  label: string;
  title: string;
  width: number;
  height: number;
  boothScale?: number;
  officialMap?: IVenueOfficialMap;
  outline?: IVenuePoint[];
  labels?: IVenueLabel[];
  areas: IVenueArea[];
}

export interface IVenueBuilding {
  id: string;
  name: string;
  shortName: string;
  levels: IVenueLevel[];
}

export interface IVendor {
  id: string;
  name: string;
  kind: VendorKind;
  tier: VendorTier;
  booth: string;
  areaId?: string;
  zone?: string;
  hall?: string;
  categories?: string[];
  levelId?: string;
  position?: IVenuePoint;
  footprint?: IVendorFootprint;
  schedule?: string;
}

export interface IVenueSource {
  label: string;
  url: string;
}

export interface IVenueSchematic {
  event: string;
  updatedAt: string;
  disclaimer: string;
  sources: IVenueSource[];
  buildings: IVenueBuilding[];
  vendors: IVendor[];
}

export interface IVenueLevelPlacement {
  building: IVenueBuilding;
  level: IVenueLevel;
}

export interface IVenueAreaPlacement extends IVenueLevelPlacement {
  area: IVenueArea;
}
