import type { IndexName } from '@kubequest/shared';

export type IngestProgress = (index: IndexName, done: number, total: number) => void;
