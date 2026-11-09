import type { IHealthResponse, IndexName } from '@kubequest/shared';
import { EsClientService } from './es-client.service';
import { allIndexNames, esTimeouts, healthCacheMs } from './es.constants';

export class EsHealthService {
  private readonly _esClient: EsClientService;
  private readonly _version: string;
  private _cached?: IHealthResponse;
  private _cachedAt = 0;
  private _inflight?: Promise<IHealthResponse>;

  public constructor(esClient: EsClientService, version: string) {
    this._esClient = esClient;
    this._version = version;
  }

  public async getHealth(): Promise<IHealthResponse> {
    const age = Date.now() - this._cachedAt;

    if (this._cached && age < healthCacheMs) {
      return this._cached;
    }

    if (this._cached) {
      void this._refresh();

      return this._cached;
    }

    return this._refresh();
  }

  private _refresh(): Promise<IHealthResponse> {
    if (!this._inflight) {
      this._inflight = this._probe()
        .then((health) => {
          this._cached = health;
          this._cachedAt = Date.now();

          return health;
        })
        .finally(() => {
          this._inflight = undefined;
        });
    }

    return this._inflight;
  }

  private async _probe(): Promise<IHealthResponse> {
    const configured = this._esClient.enabled;
    const counts: Partial<Record<IndexName, number>> = {};
    let reachable = false;

    if (configured) {
      const [pingResult, ...countResults] = await Promise.allSettled([
        this._esClient.ping(esTimeouts.HEALTH_MS),
        ...allIndexNames.map((indexName) => this._esClient.count(indexName, esTimeouts.HEALTH_MS)),
      ]);

      reachable = pingResult.status === 'fulfilled' && pingResult.value === true;
      countResults.forEach((result, position) => {
        if (result.status === 'fulfilled') {
          counts[allIndexNames[position]] = result.value;
          reachable = true;
        }
      });
    }

    return {
      status: configured && reachable ? 'ok' : 'degraded',
      version: this._version,
      elasticsearch: { configured, reachable, inferenceId: this._esClient.inferenceId, counts },
    };
  }
}
