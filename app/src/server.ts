import { container } from './container';
import { createApp } from './http/create-app';
import { toolRegistry } from './tools';

const retryDelaysMs = [0, 5000, 15000, 30000, 60000];

async function ensureIndicesWithRetry(): Promise<void> {
  if (!container.esClient.enabled) {
    console.log('elasticsearch: ELASTIC_URL or ELASTIC_API_KEY is not set, running without it');

    return;
  }

  for (const delayMs of retryDelaysMs) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    try {
      const created = await container.esIndices.ensureIndices();

      console.log(`elasticsearch: indices ready${created.length > 0 ? `, created ${created.join(', ')}` : ''}`);

      return;
    } catch (error) {
      console.error('elasticsearch: ensureIndices failed', error instanceof Error ? error.message : error);
    }
  }
}

const app = createApp(container, toolRegistry);
const server = app.listen(container.config.port, () => {
  console.log(`listening on :${container.config.port}, version ${container.config.version}`);
});

void ensureIndicesWithRetry();

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
  server.closeIdleConnections();
  setTimeout(() => process.exit(0), 10000).unref();
});
