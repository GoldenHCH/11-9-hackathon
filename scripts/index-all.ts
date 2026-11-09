import path from 'node:path';
import { closeEsClient } from '../app/src/es/client';
import { indexNames } from '../app/src/es/es.constants';
import { ensureIndices } from '../app/src/es/indices';
import { IndexName } from '../app/src/es/index-mappings';
import { bulkIndex, IBulkResult, ISeedFile, loadLocations, prepareTalks, readSeedFile, SeedDocument, seedPlayers } from './seed';

async function indexFile(index: IndexName, loaded: ISeedFile, documents: SeedDocument[], looked: string[]): Promise<number> {
  if (!loaded.file) {
    console.log(`${index}: no seed file in resources/ (looked for ${looked.join(', ')})`);
    return 0;
  }

  const result: IBulkResult = await bulkIndex(index, documents);
  console.log(`${index}: indexed ${result.indexed}, failed ${result.failed} from ${path.basename(loaded.file)}`);

  return result.failed;
}

async function main(): Promise<void> {
  const syncResults = await ensureIndices();

  for (const result of syncResults) {
    console.log(`index ${result.index}: ${result.action}${result.error ? ` (${result.error})` : ''}`);
  }

  let totalFailed = 0;

  const locations = loadLocations();
  totalFailed += await indexFile(indexNames.LOCATIONS, locations, locations.documents, ['locations.json']);

  const talkNames = ['sessions.json', 'talks.json'];
  const talks = readSeedFile(talkNames);
  totalFailed += await indexFile(indexNames.TALKS, talks, prepareTalks(talks.documents, locations.documents), talkNames);

  const players = await seedPlayers(locations.documents);
  totalFailed += players.attendees.failed + players.xpEvents.failed;

  const questNames = ['quests.seed.json', 'quests.json'];
  const quests = readSeedFile(questNames);
  totalFailed += await indexFile(indexNames.QUESTS, quests, quests.documents, questNames);

  await closeEsClient();

  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
