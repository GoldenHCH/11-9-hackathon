import { closeEsClient } from '../app/src/es/client';
import { ensureIndices } from '../app/src/es/indices';
import { runNudge } from '../app/src/notifications/nudge';

async function main(): Promise<void> {
  const synced = await ensureIndices();
  const failedIndices = synced.filter((result) => result.action === 'failed');

  for (const result of failedIndices) {
    console.warn(`index ${result.index}: failed (${result.error ?? 'unknown'})`);
  }

  const startedAt = Date.now();
  const counts = await runNudge();
  console.log(
    `nudge: players ${counts.players}, new quest notifications ${counts.questNotifications}, new match notifications ${counts.matchNotifications}, failures ${counts.failures}, ${Date.now() - startedAt} ms`,
  );
  await closeEsClient();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
