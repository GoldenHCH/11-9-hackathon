import type { estypes } from '@elastic/elasticsearch';
import { closeEsClient, esOptions, getEsClient } from '../app/src/es/client';
import { esTimeouts, indexNames } from '../app/src/es/es.constants';
import { ensureIndices } from '../app/src/es/indices';
import { handleKey, handleReservations, reservationFor, reservationId } from '../app/src/profile/handles';

const pageSize = 500;

interface IAttendeeHandle {
  handle?: string;
  createdAt?: string;
}

interface IBackfillSummary {
  attendees: number;
  reserved: number;
  alreadyReserved: number;
  duplicateHandles: string[];
  failed: string[];
}

async function attendeeHandles(): Promise<{ id: string; handle: string }[]> {
  const client = getEsClient();
  const rows: { id: string; handle: string }[] = [];
  let searchAfter: estypes.SortResults | undefined;

  for (;;) {
    const response = await client.search<IAttendeeHandle>(
      {
        index: indexNames.ATTENDEES,
        size: pageSize,
        _source: ['handle', 'createdAt'],
        sort: [{ createdAt: { order: 'asc', unmapped_type: 'date' } }, { handle: 'asc' }],
        ...(searchAfter ? { search_after: searchAfter } : {}),
      },
      esOptions(esTimeouts.SEARCH_MS),
    );
    const hits = response.hits.hits;

    for (const hit of hits) {
      const handle = hit._source?.handle;

      if (hit._id && handle) {
        rows.push({ id: hit._id, handle: handleKey(handle) });
      }
    }

    if (hits.length < pageSize) {
      return rows;
    }

    searchAfter = hits[hits.length - 1].sort;
  }
}

async function main(): Promise<void> {
  const synced = await ensureIndices();
  const failedIndices = synced.filter((result) => result.action === 'failed');

  if (failedIndices.length > 0) {
    throw new Error(`Index sync failed: ${failedIndices.map((result) => result.index).join(', ')}`);
  }

  const rows = await attendeeHandles();
  const summary: IBackfillSummary = { attendees: rows.length, reserved: 0, alreadyReserved: 0, duplicateHandles: [], failed: [] };
  const firstOwner = new Map<string, string>();

  for (const row of rows) {
    if (firstOwner.has(row.handle)) {
      summary.duplicateHandles.push(row.handle);
      continue;
    }

    firstOwner.set(row.handle, row.id);
  }

  const entries = [...firstOwner.entries()];

  for (let start = 0; start < entries.length; start += pageSize) {
    const chunk = entries.slice(start, start + pageSize);
    const operations = chunk.flatMap(([handle, attendeeId]) => [
      { create: { _index: handleReservations.INDEX, _id: reservationId(handle) } },
      reservationFor(handle, attendeeId),
    ]);
    const response = await getEsClient().bulk({ operations, refresh: 'wait_for' }, esOptions(esTimeouts.ADMIN_MS));

    response.items.forEach((item, index) => {
      const result = item.create;

      if (!result || result.status === 201) {
        summary.reserved += 1;
      } else if (result.status === 409) {
        summary.alreadyReserved += 1;
      } else {
        summary.failed.push(`${chunk[index][0]}: ${result.error?.reason ?? result.status}`);
      }
    });
  }

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

  if (summary.failed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`reserve-handles failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => closeEsClient());
