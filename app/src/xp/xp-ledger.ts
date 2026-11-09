import type { estypes } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { materials } from '../types/kubequest.constants';
import { BannerId, IsoDateString, Material, MaterialCounts } from '../types/kubequest.types';

export interface ILedgerSummary {
  blocks: MaterialCounts;
  totalBlocks: number;
  gems: number;
  handshakes: number;
  welcomes: number;
  outpostsToday: number;
  earnedBanners: Partial<Record<BannerId, IsoDateString>>;
}

interface ITermsBucket {
  key: string;
  doc_count: number;
  first?: { value: number | null; value_as_string?: string };
}

interface ILedgerAggregations {
  blocks?: { buckets: ITermsBucket[] };
  gems?: { value: number | null };
  handshakes?: { doc_count: number };
  welcomes?: { doc_count: number };
  outposts_today?: { doc_count: number };
  badges?: { buckets: ITermsBucket[] };
}

export function emptyBlocks(): MaterialCounts {
  return Object.fromEntries(materials.map((material) => [material, 0])) as MaterialCounts;
}

export interface IAttendeeInventoryDoc {
  xp?: number;
  level?: number;
  banners?: string[];
  isSpeaker?: boolean;
  inventory?: {
    blocks?: Partial<Record<string, number>>;
    gems?: number;
    handshakes?: number;
    welcomes?: number;
    outposts?: number;
  };
}

export function summaryFromAttendee(doc: IAttendeeInventoryDoc): ILedgerSummary {
  const blocks = emptyBlocks();

  for (const [key, count] of Object.entries(doc.inventory?.blocks ?? {})) {
    if (isMaterial(key) && typeof count === 'number') {
      blocks[key] = count;
    }
  }

  const earnedBanners: Partial<Record<BannerId, IsoDateString>> = {};

  for (const banner of doc.banners ?? []) {
    earnedBanners[banner as BannerId] = '';
  }

  return {
    blocks,
    totalBlocks: Object.values(blocks).reduce((sum, count) => sum + count, 0),
    gems: doc.inventory?.gems ?? 0,
    handshakes: doc.inventory?.handshakes ?? 0,
    welcomes: doc.inventory?.welcomes ?? 0,
    outpostsToday: 0,
    earnedBanners,
  };
}

export function mergeSummaries(ledger: ILedgerSummary, live: ILedgerSummary): ILedgerSummary {
  const blocks = emptyBlocks();

  for (const material of materials) {
    blocks[material] = Math.max(ledger.blocks[material], live.blocks[material]);
  }

  const earnedBanners: Partial<Record<BannerId, IsoDateString>> = { ...live.earnedBanners, ...ledger.earnedBanners };

  return {
    blocks,
    totalBlocks: Object.values(blocks).reduce((sum, count) => sum + count, 0),
    gems: Math.max(ledger.gems, live.gems),
    handshakes: Math.max(ledger.handshakes, live.handshakes),
    welcomes: Math.max(ledger.welcomes, live.welcomes),
    outpostsToday: ledger.outpostsToday,
    earnedBanners,
  };
}

function isMaterial(value: string): value is Material {
  return (materials as readonly string[]).includes(value);
}

export async function summarizeLedger(attendeeId: string): Promise<ILedgerSummary> {
  const aggregations: Record<string, estypes.AggregationsAggregationContainer> = {
    blocks: { terms: { field: 'material', size: materials.length } },
    gems: { sum: { field: 'gems' } },
    handshakes: { filter: { term: { type: 'handshake' } } },
    welcomes: { filter: { term: { type: 'welcome' } } },
    outposts_today: { filter: { bool: { filter: [{ term: { type: 'outpost' } }, { range: { at: { gte: 'now-24h' } } }] } } },
    badges: {
      filter: { term: { type: 'badge' } },
      aggs: { names: { terms: { field: 'banner', size: 20 }, aggs: { first: { min: { field: 'at' } } } } },
    },
  };

  const response = await getEsClient().search(
    {
      index: indexNames.XP_EVENTS,
      size: 0,
      query: { term: { attendeeId } },
      aggs: aggregations,
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const aggs = (response.aggregations ?? {}) as ILedgerAggregations & { badges?: { names?: { buckets: ITermsBucket[] } } };
  const blocks = emptyBlocks();

  for (const bucket of aggs.blocks?.buckets ?? []) {
    if (isMaterial(bucket.key)) {
      blocks[bucket.key] = bucket.doc_count;
    }
  }

  const earnedBanners: Partial<Record<BannerId, IsoDateString>> = {};

  for (const bucket of aggs.badges?.names?.buckets ?? []) {
    earnedBanners[bucket.key as BannerId] = bucket.first?.value_as_string ?? new Date().toISOString();
  }

  return {
    blocks,
    totalBlocks: Object.values(blocks).reduce((sum, count) => sum + count, 0),
    gems: Math.round(aggs.gems?.value ?? 0),
    handshakes: aggs.handshakes?.doc_count ?? 0,
    welcomes: aggs.welcomes?.doc_count ?? 0,
    outpostsToday: aggs.outposts_today?.doc_count ?? 0,
    earnedBanners,
  };
}
