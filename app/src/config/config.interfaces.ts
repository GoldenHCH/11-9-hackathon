export interface IElasticConfig {
  url?: string;
  apiKey?: string;
  inferenceId: string;
  requestTimeoutMs: number;
}

export interface IAppConfig {
  port: number;
  version: string;
  seedNow?: string;
  elastic: IElasticConfig;
  resourcesDir: string;
  publicDir: string;
  webDistDirs: string[];
}
