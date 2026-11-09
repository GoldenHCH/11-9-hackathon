import type { IAppConfig } from './config/config.interfaces';
import type { EsClientService } from './es/es-client.service';
import type { EsHealthService } from './es/es-health.service';
import type { EsIndicesService } from './es/es-indices.service';
import type { ResourceStoreService } from './resources/resource-store.service';

export interface IContainer {
  config: IAppConfig;
  esClient: EsClientService;
  esIndices: EsIndicesService;
  esHealth: EsHealthService;
  store: ResourceStoreService;
}
