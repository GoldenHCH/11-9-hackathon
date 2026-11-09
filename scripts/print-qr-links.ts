import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { appConfig } from '../app/src/config';
import { closeEsClient, esOptions, getEsClient, isElasticConfigured } from '../app/src/es/client';
import { esTimeouts, indexNames } from '../app/src/es/es.constants';
import { buildScanUrl, signLocationToken, signScreenDisplayKey } from '../app/src/security/tokens';

interface ILocationRow {
  id: string;
  name?: string;
  kind?: string;
  hasScreen?: boolean;
}

const locationsFile = path.resolve(__dirname, '..', 'resources', 'locations.json');

function screenUrl(locationId: string): string {
  const url = new URL(`/screen/${encodeURIComponent(locationId)}`, appConfig.publicBaseUrl);
  url.searchParams.set('key', signScreenDisplayKey(locationId));

  return url.toString();
}

function isLocationRow(value: unknown): value is ILocationRow {
  return typeof value === 'object' && value !== null && typeof Reflect.get(value, 'id') === 'string';
}

function fromFile(): ILocationRow[] {
  if (!existsSync(locationsFile)) {
    return [];
  }

  const parsed: unknown = JSON.parse(readFileSync(locationsFile, 'utf8'));

  return Array.isArray(parsed) ? parsed.filter(isLocationRow) : [];
}

async function fromElastic(): Promise<ILocationRow[]> {
  if (!isElasticConfigured()) {
    return [];
  }

  const response = await getEsClient().search<ILocationRow>(
    { index: indexNames.LOCATIONS, size: 1000, _source: ['id', 'name', 'kind', 'hasScreen'], query: { match_all: {} } },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return (response.hits?.hits ?? []).map((hit) => hit._source).filter(isLocationRow);
}

async function main(): Promise<void> {
  const fileRows = fromFile();
  const rows = fileRows.length > 0 ? fileRows : await fromElastic();

  if (rows.length === 0) {
    process.stderr.write('No locations found in resources/locations.json or Elasticsearch.\n');
    process.exitCode = 1;

    return;
  }

  for (const row of rows.sort((left, right) => left.id.localeCompare(right.id))) {
    process.stdout.write(`${row.id}\t${row.kind ?? ''}\t${row.name ?? ''}\t${buildScanUrl(row.id, signLocationToken(row.id))}\n`);
  }

  for (const row of rows.filter((candidate) => candidate.hasScreen === true)) {
    process.stdout.write(`screen\t${row.id}\t${screenUrl(row.id)}\n`);
  }
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeEsClient());
