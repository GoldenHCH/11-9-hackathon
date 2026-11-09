export interface IHealthCounts {
  talks?: number;
  attendees?: number;
  locations?: number;
  xp_events?: number;
  intros?: number;
}

export interface IHealthElasticsearch {
  configured: boolean;
  reachable: boolean;
  inferenceId: string;
  counts: IHealthCounts;
}

export interface IHealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  elasticsearch: IHealthElasticsearch;
}
