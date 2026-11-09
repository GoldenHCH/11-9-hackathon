import { shutdownTelemetry } from './otel';
import { createApp } from './app';
import { appConfig } from './config';
import { closeEsClient, isElasticConfigured } from './es/client';
import { ensureIndices } from './es/indices';
import { logger } from './observability/logger';

const app = createApp();

const server = app.listen(appConfig.port, () => {
  logger.info({ port: appConfig.port, version: appConfig.appVersion, elasticsearch: isElasticConfigured() }, 'kubequest api listening');
});

if (appConfig.ensureIndicesOnStart && isElasticConfigured()) {
  ensureIndices().catch((error: unknown) => {
    logger.error({ err: error }, 'could not sync elasticsearch indices');
  });
}

function shutdown(signal: string): void {
  logger.info({ signal }, 'shutting down');
  server.close(() => {
    Promise.allSettled([closeEsClient(), shutdownTelemetry()]).finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
