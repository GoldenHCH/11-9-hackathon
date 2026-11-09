import { IFacetCount, QuestStatus } from '../core/interfaces/exhibitor.interfaces';
import { ExhibitorFilterKey } from './exhibitors.types';

export interface IExhibitorFilters {
  type?: string;
  tier?: string;
  zone?: string;
  topic?: string;
}

export interface IFacetOption extends IFacetCount {
  label: string;
}

export interface IFacetGroup {
  key: ExhibitorFilterKey;
  label: string;
  options: IFacetOption[];
}

export interface IMakeOutpostQuestInput {
  attendeeId: string;
  targetKind: 'outpost';
  targetId: string;
}

export interface IMadeQuest {
  id: string;
  title: string;
  status: QuestStatus;
  nextStep?: string;
}

export interface IMiniMapArea {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fill: string;
  showLabel: boolean;
  isHome: boolean;
}

export interface IMiniMap {
  viewBox: string;
  areas: IMiniMapArea[];
  markerX: number;
  markerY: number;
  markerSize: number;
}
