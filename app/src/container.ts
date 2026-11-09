import './config/load-env';
import { ConfigHelper } from './config/config.helper';
import type { IAppConfig } from './config/config.interfaces';
import type { IContainer } from './container.interfaces';
import { EsClientService } from './es/es-client.service';
import { EsHealthService } from './es/es-health.service';
import { EsIndicesService } from './es/es-indices.service';
import { ResourceStoreService } from './resources/resource-store.service';

export function buildContainer(config: IAppConfig): IContainer {
  const esClient = new EsClientService(config.elastic);

  return {
    config,
    esClient,
    esIndices: new EsIndicesService(esClient),
    esHealth: new EsHealthService(esClient, config.version),
    store: new ResourceStoreService(config.resourcesDir, config.seedNow),
  };
}

export const container: IContainer = buildContainer(ConfigHelper.fromEnv(process.env));
