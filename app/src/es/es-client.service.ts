import { Client } from '@elastic/elasticsearch';
import type { estypes } from '@elastic/elasticsearch';
import type { IElasticConfig } from '../config/config.interfaces';
import type { IBulkDocument, IBulkResult } from './es.interfaces';

export class EsClientService {
  private readonly _client?: Client;
  private readonly _config: IElasticConfig;

  public constructor(config: IElasticConfig) {
    this._config = config;

    if (config.url && config.apiKey) {
      this._client = new Client({
        node: config.url,
        auth: { apiKey: config.apiKey },
        serverMode: 'serverless',
        requestTimeout: config.requestTimeoutMs,
        maxRetries: 1,
      });
    }
  }

  public get enabled(): boolean {
    return this._client !== undefined;
  }

  public get inferenceId(): string {
    return this._config.inferenceId;
  }

  public async ping(timeoutMs: number): Promise<boolean> {
    return this.requireClient().ping({}, { requestTimeout: timeoutMs });
  }

  public async count(index: string, timeoutMs: number): Promise<number> {
    const response = await this.requireClient().count({ index }, { requestTimeout: timeoutMs });

    return response.count;
  }

  public async indexExists(index: string): Promise<boolean> {
    return this.requireClient().indices.exists({ index }, { requestTimeout: this._config.requestTimeoutMs });
  }

  public async createIndex(index: string, mappings: estypes.MappingTypeMapping, timeoutMs: number): Promise<void> {
    await this.requireClient().indices.create({ index, mappings }, { requestTimeout: timeoutMs });
  }

  public async indexDocument(index: string, id: string, document: object): Promise<void> {
    await this.requireClient().index({ index, id, document }, { requestTimeout: this._config.requestTimeoutMs });
  }

  public async updateDocument(index: string, id: string, partial: object): Promise<void> {
    await this.requireClient().update({ index, id, doc: partial }, { requestTimeout: this._config.requestTimeoutMs });
  }

  public async bulkIndex(index: string, documents: IBulkDocument[], timeoutMs: number): Promise<IBulkResult> {
    if (documents.length === 0) {
      return { indexed: 0, failed: 0 };
    }

    const operations = documents.flatMap((document) => [{ index: { _index: index, _id: document.id } }, document.body]);
    const response = await this.requireClient().bulk({ operations, refresh: false }, { requestTimeout: timeoutMs });
    const failedItems = response.items.filter((item) => item.index?.error !== undefined);
    const firstFailure = failedItems[0]?.index?.error;

    return {
      indexed: documents.length - failedItems.length,
      failed: failedItems.length,
      firstError: firstFailure ? `${firstFailure.type}: ${firstFailure.reason}` : undefined,
    };
  }

  public async refresh(index: string, timeoutMs: number): Promise<void> {
    await this.requireClient().indices.refresh({ index }, { requestTimeout: timeoutMs });
  }

  private requireClient(): Client {
    if (!this._client) {
      throw new Error('Elasticsearch is not configured. Set ELASTIC_URL and ELASTIC_API_KEY.');
    }

    return this._client;
  }
}
