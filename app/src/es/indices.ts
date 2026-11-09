import type { estypes } from '@elastic/elasticsearch';
import { appConfig } from '../config';
import { logger } from '../observability/logger';
import { tracer } from '../observability/tracing';
import { esOptions, getEsClient } from './client';
import { esTimeouts } from './es.constants';
import { buildIndexMappings, IndexName } from './index-mappings';

type Properties = Record<string, estypes.MappingProperty>;

export interface IIndexSyncResult {
  index: IndexName;
  action: 'created' | 'updated' | 'unchanged' | 'failed';
  addedFields: string[];
  error?: string;
}

function childProperties(property: estypes.MappingProperty | undefined): Properties | undefined {
  if (property && 'properties' in property && property.properties) {
    return property.properties;
  }

  return undefined;
}

export function missingProperties(desired: Properties, existing: Properties | undefined): Properties {
  const missing: Properties = {};

  for (const [fieldName, desiredProperty] of Object.entries(desired)) {
    const existingProperty = existing?.[fieldName];

    if (!existingProperty) {
      missing[fieldName] = desiredProperty;
      continue;
    }

    const desiredChildren = childProperties(desiredProperty);

    if (!desiredChildren) {
      continue;
    }

    const missingChildren = missingProperties(desiredChildren, childProperties(existingProperty));

    if (Object.keys(missingChildren).length > 0) {
      const parentType = 'type' in existingProperty && existingProperty.type === 'nested' ? { type: 'nested' as const } : {};
      missing[fieldName] = { ...parentType, properties: missingChildren };
    }
  }

  return missing;
}

function flattenFieldNames(properties: Properties, prefix = ''): string[] {
  return Object.entries(properties).flatMap(([fieldName, property]) => {
    const path = `${prefix}${fieldName}`;
    const children = childProperties(property);

    return children ? flattenFieldNames(children, `${path}.`) : [path];
  });
}

async function syncIndex(index: IndexName, desired: Properties): Promise<IIndexSyncResult> {
  const client = getEsClient();
  const exists = await client.indices.exists({ index }, esOptions(esTimeouts.ADMIN_MS));

  if (!exists) {
    await client.indices.create({ index, mappings: { properties: desired } }, esOptions(esTimeouts.ADMIN_MS));

    return { index, action: 'created', addedFields: flattenFieldNames(desired) };
  }

  const mappingResponse = await client.indices.getMapping({ index }, esOptions(esTimeouts.ADMIN_MS));
  const existing = mappingResponse[index]?.mappings.properties;
  const missing = missingProperties(desired, existing);

  if (Object.keys(missing).length === 0) {
    return { index, action: 'unchanged', addedFields: [] };
  }

  await client.indices.putMapping({ index, properties: missing }, esOptions(esTimeouts.ADMIN_MS));

  return { index, action: 'updated', addedFields: flattenFieldNames(missing) };
}

export async function ensureIndices(): Promise<IIndexSyncResult[]> {
  return tracer.startActiveSpan('es.ensure_indices', async (span) => {
    const mappings = buildIndexMappings(appConfig.elastic.embeddingInferenceId);
    const results: IIndexSyncResult[] = [];

    for (const [index, desired] of Object.entries(mappings) as [IndexName, Properties][]) {
      try {
        results.push(await syncIndex(index, desired));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ index, action: 'failed', addedFields: [], error: message });
      }
    }

    for (const result of results) {
      span.setAttribute(`kubequest.index.${result.index}`, result.action);
    }

    logger.info({ indices: results }, 'elasticsearch indices synced');
    span.end();

    return results;
  });
}
