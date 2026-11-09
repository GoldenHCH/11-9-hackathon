import type { estypes } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import { logger } from '../observability/logger';

export const rerankSettings = {
  INFERENCE_ID: process.env.ELASTIC_RERANK_INFERENCE_ID?.trim() || '.jina-reranker-v3',
  WINDOW: 20,
  MAX_TEXT_CHARS: 1000,
  COOLDOWN_MS: 5 * 60 * 1000,
} as const;

export type SearchMode = 'reranked' | 'hybrid' | 'lexical' | 'browse';

export interface ISearchAttempt<T> {
  mode: SearchMode;
  run: () => Promise<T>;
}

let rerankBlockedUntil = 0;

function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const status: unknown = Reflect.get(error, 'statusCode') ?? Reflect.get(Reflect.get(error, 'meta') ?? {}, 'statusCode');

  return typeof status === 'number' ? status : undefined;
}

export function isRerankAvailable(): boolean {
  return Date.now() >= rerankBlockedUntil;
}

export function rerankRetriever(
  retriever: estypes.RetrieverContainer,
  field: string,
  text: string,
  size: number,
): estypes.RetrieverContainer {
  return {
    text_similarity_reranker: {
      retriever,
      field,
      inference_id: rerankSettings.INFERENCE_ID,
      inference_text: text.slice(0, rerankSettings.MAX_TEXT_CHARS),
      rank_window_size: Math.max(rerankSettings.WINDOW, size),
    },
  };
}

export async function searchWithFallbacks<T>(label: string, attempts: ISearchAttempt<T>[]): Promise<{ mode: SearchMode; result: T }> {
  const span = trace.getActiveSpan();
  const runnable = attempts.filter((attempt) => attempt.mode !== 'reranked' || isRerankAvailable());
  let lastError: unknown;

  for (const attempt of runnable) {
    try {
      const result = await attempt.run();
      span?.setAttributes({ [`kubequest.${label}.mode`]: attempt.mode, ...(attempt.mode === 'reranked' ? { 'kubequest.rerank.inference_id': rerankSettings.INFERENCE_ID } : {}) });

      return { mode: attempt.mode, result };
    } catch (error) {
      lastError = error;
      const status = statusOf(error);

      if (attempt.mode === 'reranked' && status !== undefined && status >= 400 && status < 500) {
        rerankBlockedUntil = Date.now() + rerankSettings.COOLDOWN_MS;
      }

      span?.addEvent(`${label}.fallback`, { from: attempt.mode, status: status ?? 0 });
      logger.warn({ err: error, label, mode: attempt.mode }, 'search attempt failed, trying the next one');
    }
  }

  throw lastError;
}
