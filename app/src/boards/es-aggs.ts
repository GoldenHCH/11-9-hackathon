export interface ITermsBucket {
  key: string;
  doc_count: number;
  [subAggregation: string]: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function termsBuckets(aggregations: unknown, name: string): ITermsBucket[] {
  if (!isRecord(aggregations)) {
    return [];
  }

  const aggregation = aggregations[name];

  if (!isRecord(aggregation) || !Array.isArray(aggregation.buckets)) {
    return [];
  }

  return aggregation.buckets.filter(
    (bucket): bucket is ITermsBucket => isRecord(bucket) && typeof bucket.key === 'string' && typeof bucket.doc_count === 'number',
  );
}

export function metricValue(container: unknown, name: string): number {
  if (!isRecord(container)) {
    return 0;
  }

  const aggregation = container[name];

  if (isRecord(aggregation) && typeof aggregation.value === 'number') {
    return aggregation.value;
  }

  return 0;
}

export function topHitSource(container: unknown, name: string): Record<string, unknown> | undefined {
  if (!isRecord(container)) {
    return undefined;
  }

  const aggregation = container[name];

  if (!isRecord(aggregation) || !isRecord(aggregation.hits) || !Array.isArray(aggregation.hits.hits)) {
    return undefined;
  }

  const first: unknown = aggregation.hits.hits[0];

  return isRecord(first) && isRecord(first._source) ? first._source : undefined;
}

export function stringField(source: Record<string, unknown> | undefined, field: string): string | undefined {
  const value = source?.[field];

  return typeof value === 'string' ? value : undefined;
}
