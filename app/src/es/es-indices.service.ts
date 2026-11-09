import { EsClientService } from './es-client.service';
import { EsMappingsHelper } from './es-mappings.helper';
import { allIndexNames, esTimeouts } from './es.constants';

export class EsIndicesService {
  private readonly _esClient: EsClientService;

  public constructor(esClient: EsClientService) {
    this._esClient = esClient;
  }

  public async ensureIndices(timeoutMs: number = esTimeouts.BULK_MS): Promise<string[]> {
    if (!this._esClient.enabled) {
      return [];
    }

    const mappings = EsMappingsHelper.buildMappings(this._esClient.inferenceId);
    const created: string[] = [];

    for (const indexName of allIndexNames) {
      const exists = await this._esClient.indexExists(indexName);

      if (!exists) {
        await this._createIgnoringRace(indexName, mappings[indexName], timeoutMs);
        created.push(indexName);
      }
    }

    return created;
  }

  private async _createIgnoringRace(
    indexName: (typeof allIndexNames)[number],
    mappings: ReturnType<typeof EsMappingsHelper.buildMappings>[typeof indexName],
    timeoutMs: number,
  ): Promise<void> {
    try {
      await this._esClient.createIndex(indexName, mappings, timeoutMs);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (!message.includes('resource_already_exists_exception')) {
        throw error;
      }
    }
  }
}
