export interface IBarListItem {
  label: string;
  value: number;
  detail?: string;
}

export interface IBarListRow extends IBarListItem {
  percent: number;
}
