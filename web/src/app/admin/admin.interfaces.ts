export interface IBossRow {
  id: string;
  title: string;
  status: string;
  health: number;
  maxHealth: number;
  percent: number;
  participants: number;
}

export interface IBoothLink {
  id: string;
  name: string;
  detail: string;
}

export interface IAdminKpi {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
}
