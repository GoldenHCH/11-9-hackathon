import type { IndexName } from '@kubequest/shared';

export interface IIngestSummary {
  index: IndexName;
  sent: number;
  indexed: number;
  failed: number;
  total: number;
  firstError?: string;
}
