import { IHealthResponse } from '../core/interfaces/health.interfaces';

export interface IStatusBadge {
  label: string;
  icon: string;
  tone: 'ok' | 'warn' | 'error';
}

export interface IHealthCountItem {
  key: string;
  label: string;
  value: string;
}

export interface IHealthViewState {
  phase: 'loading' | 'ready' | 'error';
  errorMessage?: string;
  health?: IHealthResponse;
  overallBadge?: IStatusBadge;
  elasticsearchBadge?: IStatusBadge;
  countItems?: IHealthCountItem[];
}
