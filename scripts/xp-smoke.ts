import { esOptions, getEsClient } from '../app/src/es/client';
import { esTimeouts, indexNames } from '../app/src/es/es.constants';
import { inventoryTool } from '../app/src/tools/inventory.tool';
import { awardXpDetailed } from '../app/src/xp/award';

async function main(): Promise<void> {
  const attendeeId = `xp-smoke-${Date.now()}`;
  const client = getEsClient();
  await client.index(
    { index: indexNames.ATTENDEES, id: attendeeId, document: { id: attendeeId, handle: 'smoke', xp: 0, level: 1, banners: [], visible: false }, refresh: 'wait_for' },
    esOptions(esTimeouts.WRITE_MS),
  );

  try {
    for (let i = 0; i < 3; i += 1) {
      const outcome = await awardXpDetailed({ attendeeId, type: 'check_in', xp: 10, material: 'glass', locationId: 'smoke-room' });
      process.stdout.write(`check_in xp=${outcome.xpAfter} level=${outcome.level.name} levelUp=${outcome.levelUp?.name ?? '-'} banners=${outcome.newBanners.map((b) => b.id).join(',')} trace=${outcome.event.traceId ? 'yes' : 'no'}\n`);
    }

    for (let i = 0; i < 3; i += 1) {
      const outcome = await awardXpDetailed({ attendeeId, type: 'handshake', xp: 50, gems: 1, introId: `smoke-intro-${i}` });
      process.stdout.write(`handshake xp=${outcome.xpAfter} level=${outcome.level.name} banners=${outcome.newBanners.map((b) => b.id).join(',')}\n`);
    }

    for (let i = 0; i < 2; i += 1) {
      const outcome = await awardXpDetailed({ attendeeId, type: 'welcome', xp: 25, introId: `smoke-intro-${i}` });
      process.stdout.write(`welcome xp=${outcome.xpAfter} banners=${outcome.newBanners.map((b) => b.id).join(',')}\n`);
    }

    const inventory = await inventoryTool.execute({ attendeeId });
    process.stdout.write(`${JSON.stringify(inventory)}\n`);
    const doc = await client.get({ index: indexNames.ATTENDEES, id: attendeeId }, esOptions());
    process.stdout.write(`${JSON.stringify(doc._source)}\n`);
  } finally {
    await client.deleteByQuery({ index: indexNames.XP_EVENTS, query: { term: { attendeeId } }, refresh: true }, esOptions(esTimeouts.ADMIN_MS));
    await client.delete({ index: indexNames.ATTENDEES, id: attendeeId, refresh: true }, esOptions());
  }
}

main().then(
  () => process.exit(0),
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  },
);
