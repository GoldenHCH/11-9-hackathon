import '../app/src/config/load-env';
import { ConfigHelper } from '../app/src/config/config.helper';
import { EsClientService } from '../app/src/es/es-client.service';
import { EsIndicesService } from '../app/src/es/es-indices.service';
import { EsIngestService } from '../app/src/es/es-ingest.service';
import { esTimeouts } from '../app/src/es/es.constants';
import { ResourceStoreService } from '../app/src/resources/resource-store.service';

const batchSize = 50;

async function main(): Promise<void> {
  const config = ConfigHelper.fromEnv(process.env);
  const esClient = new EsClientService({ ...config.elastic, requestTimeoutMs: esTimeouts.BULK_MS });

  if (!esClient.enabled) {
    console.error('index-all: set ELASTIC_URL and ELASTIC_API_KEY (in .env or the environment) first.');
    process.exit(1);
  }

  const store = new ResourceStoreService(config.resourcesDir, config.seedNow);
  const ingest = new EsIngestService(esClient, store, new EsIndicesService(esClient));

  console.log(`index-all: reading ${config.resourcesDir}, inference endpoint ${config.elastic.inferenceId}`);

  const summaries = await ingest.indexAll(batchSize, (index, done, total) => {
    console.log(`  ${index}: ${done}/${total}`);
  });

  console.log('\nindex      sent  indexed  failed  in index');

  for (const summary of summaries) {
    console.log(
      `${summary.index.padEnd(10)} ${String(summary.sent).padStart(4)}  ${String(summary.indexed).padStart(7)}  ${String(summary.failed).padStart(6)}  ${String(summary.total).padStart(8)}`,
    );
  }

  const failed = summaries.filter((summary) => summary.failed > 0);

  if (failed.length > 0) {
    failed.forEach((summary) => console.error(`${summary.index}: first error: ${summary.firstError}`));
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('index-all failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
