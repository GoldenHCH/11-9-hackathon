export interface IStaffLink {
  key: string;
  outpostId: string | null;
}

export interface IHourBar {
  label: string;
  visits: number;
  percent: number;
}

export interface IVisitorRow {
  id: string;
  handle: string;
  faceSeed: string;
  levelName: string;
  when: string;
  firstTimer: boolean;
}
