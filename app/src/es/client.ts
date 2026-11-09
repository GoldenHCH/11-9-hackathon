import { Client } from '@elastic/elasticsearch';
import type { TransportRequestOptions } from '@elastic/elasticsearch';
import { appConfig } from '../config';
import { ToolError } from '../tools/tool-errors';
import { esTimeouts } from './es.constants';

let elasticClient: Client | undefined;

export function isElasticConfigured(): boolean {
  return appConfig.elastic.url !== '' && appConfig.elastic.apiKey !== '';
}

export function getEsClient(): Client {
  if (!isElasticConfigured()) {
    throw new ToolError(503, 'datastore_unavailable', 'The game data store is not configured yet. Try again in a minute.');
  }

  elasticClient ??= new Client({
    node: appConfig.elastic.url,
    auth: { apiKey: appConfig.elastic.apiKey },
    serverMode: 'serverless',
    requestTimeout: esTimeouts.INFERENCE_MS,
    maxRetries: 1,
  });

  return elasticClient;
}

export function esOptions(timeoutMs: number = esTimeouts.DEFAULT_MS): TransportRequestOptions {
  return { requestTimeout: timeoutMs, maxRetries: 1 };
}

export async function pingElastic(): Promise<boolean> {
  if (!isElasticConfigured()) {
    return false;
  }

  try {
    return await getEsClient().ping(undefined, esOptions(esTimeouts.HEALTH_MS));
  } catch {
    return false;
  }
}

export async function closeEsClient(): Promise<void> {
  await elasticClient?.close();
  elasticClient = undefined;
}
