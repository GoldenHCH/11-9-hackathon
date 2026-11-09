import { createHash } from 'node:crypto';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { IStoredHandshake } from '../types/internal.interfaces';

export interface IVersionedHandshake {
  handshake: IStoredHandshake;
  seqNo: number;
  primaryTerm: number;
}

export function handshakeIdFor(nonce: string): string {
  return `hs-${createHash('sha256').update(`handshake:${nonce}`).digest('hex').slice(0, 24)}`;
}

export async function createHandshake(handshake: IStoredHandshake): Promise<void> {
  await getEsClient().index(
    { index: indexNames.HANDSHAKES, id: handshake.id, document: handshake, op_type: 'create', refresh: true },
    esOptions(esTimeouts.WRITE_MS),
  );
}

export async function getHandshake(handshakeId: string): Promise<IVersionedHandshake | undefined> {
  const response = await getEsClient().get<IStoredHandshake>(
    { index: indexNames.HANDSHAKES, id: handshakeId },
    { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] },
  );

  if (!response.found || !response._source || response._seq_no === undefined || response._primary_term === undefined) {
    return undefined;
  }

  return { handshake: { ...response._source, id: handshakeId }, seqNo: response._seq_no, primaryTerm: response._primary_term };
}

export async function replaceHandshake(stored: IVersionedHandshake, handshake: IStoredHandshake): Promise<void> {
  await getEsClient().index(
    {
      index: indexNames.HANDSHAKES,
      id: handshake.id,
      document: handshake,
      if_seq_no: stored.seqNo,
      if_primary_term: stored.primaryTerm,
      refresh: true,
    },
    esOptions(esTimeouts.WRITE_MS),
  );
}

function involving(attendeeId: string): object {
  return { bool: { should: [{ term: { askerId: attendeeId } }, { term: { answererId: attendeeId } }], minimum_should_match: 1 } };
}

async function searchHandshakes(filter: object[], sortField: 'createdAt' | 'matchedAt', order: 'asc' | 'desc', size: number): Promise<IVersionedHandshake[]> {
  const response = await getEsClient().search<IStoredHandshake>(
    {
      index: indexNames.HANDSHAKES,
      query: { bool: { filter } },
      sort: [{ [sortField]: { order } }],
      size,
      seq_no_primary_term: true,
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return (response.hits?.hits ?? []).flatMap((hit) =>
    hit._source && hit._id && hit._seq_no !== undefined && hit._primary_term !== undefined
      ? [{ handshake: { ...hit._source, id: hit._id }, seqNo: hit._seq_no, primaryTerm: hit._primary_term }]
      : [],
  );
}

export async function findOpenHandshake(attendeeId: string, now: Date): Promise<IVersionedHandshake | undefined> {
  const found = await searchHandshakes(
    [involving(attendeeId), { term: { status: 'waiting' } }, { range: { expiresAt: { gt: now.toISOString() } } }],
    'createdAt',
    'desc',
    1,
  );

  return found[0];
}

export async function findOpenPairHandshake(askerId: string, answererId: string, now: Date): Promise<IVersionedHandshake | undefined> {
  const found = await searchHandshakes(
    [{ term: { askerId } }, { term: { answererId } }, { term: { status: 'waiting' } }, { range: { expiresAt: { gt: now.toISOString() } } }],
    'createdAt',
    'desc',
    1,
  );

  return found[0];
}

export async function pairMatchedOn(pairKey: string): Promise<boolean> {
  const found = await searchHandshakes([{ term: { pairKey } }, { term: { status: 'matched' } }], 'createdAt', 'desc', 1);

  return found.length > 0;
}

export async function matchedHandshakes(attendeeId: string): Promise<IStoredHandshake[]> {
  const found = await searchHandshakes([involving(attendeeId), { term: { status: 'matched' } }], 'matchedAt', 'asc', 200);

  return found.map((stored) => stored.handshake);
}

export async function countHandshakeXpSince(attendeeId: string, since: Date): Promise<number> {
  const response = await getEsClient().count(
    {
      index: indexNames.XP_EVENTS,
      query: {
        bool: {
          filter: [{ term: { attendeeId } }, { term: { type: 'handshake' } }, { range: { at: { gte: since.toISOString() } } }],
        },
      },
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return response.count ?? 0;
}
