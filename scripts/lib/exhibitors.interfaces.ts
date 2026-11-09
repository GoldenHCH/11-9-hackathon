export interface ISponsorRow {
  name: string;
  tier: string;
  booth: string | string[] | null;
  categories?: string[];
  zone?: string;
  mapX?: number;
  mapY?: number;
  hall?: string;
}

export interface IProjectKioskRow {
  project: string;
  kiosk: string;
  schedule: string;
}

export interface IKioskSlot {
  row: number;
  side: string;
}
