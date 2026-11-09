import { createHash } from 'node:crypto';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { ToolError } from '../tools/tool-errors';
import { IAttendee, IIntro, ILocation } from '../types/kubequest.interfaces';

export interface IStoredIntro {
  intro: IIntro;
  seqNo: number;
  primaryTerm: number;
}

export function pairKeyFor(firstId: string, secondId: string, at: Date): string {
  const [low, high] = [firstId, secondId].sort();

  return `${low}|${high}|${at.toISOString().slice(0, 10)}`;
}

export function meetIdFor(pairKey: string): string {
  return `meet-${createHash('sha256').update(pairKey).digest('hex').slice(0, 24)}`;
}

export function isConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'meta' in error && Reflect.get(Reflect.get(error, 'meta') ?? {}, 'statusCode') === 409;
}

export async function getAttendee(attendeeId: string): Promise<IAttendee> {
  const response = await getEsClient().get<IAttendee>(
    { index: indexNames.ATTENDEES, id: attendeeId },
    { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] },
  );

  if (!response.found || !response._source) {
    throw new ToolError(404, 'unknown_attendee', 'That player is not in the game.');
  }

  return { ...response._source, id: attendeeId };
}

export async function getLocations(ids: string[]): Promise<Map<string, ILocation>> {
  const unique = [...new Set(ids.filter((id) => id !== ''))];
  const found = new Map<string, ILocation>();

  if (unique.length === 0) {
    return found;
  }

  const response = await getEsClient().mget<ILocation>({ index: indexNames.LOCATIONS, ids: unique }, esOptions(esTimeouts.DEFAULT_MS));

  for (const doc of response.docs) {
    if ('found' in doc && doc.found && doc._source) {
      found.set(doc._id, { ...doc._source, id: doc._id });
    }
  }

  return found;
}

export async function getIntro(meetId: string): Promise<IStoredIntro | undefined> {
  const response = await getEsClient().get<IIntro>(
    { index: indexNames.INTROS, id: meetId },
    { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] },
  );

  if (!response.found || !response._source || response._seq_no === undefined || response._primary_term === undefined) {
    return undefined;
  }

  return { intro: { ...response._source, id: meetId }, seqNo: response._seq_no, primaryTerm: response._primary_term };
}

export async function createIntro(intro: IIntro): Promise<void> {
  await getEsClient().index(
    { index: indexNames.INTROS, id: intro.id, document: intro, op_type: 'create', refresh: true },
    esOptions(esTimeouts.WRITE_MS),
  );
}

export async function replaceIntro(stored: IStoredIntro, intro: IIntro): Promise<void> {
  await getEsClient().index(
    {
      index: indexNames.INTROS,
      id: intro.id,
      document: intro,
      if_seq_no: stored.seqNo,
      if_primary_term: stored.primaryTerm,
      refresh: true,
    },
    esOptions(esTimeouts.WRITE_MS),
  );
}

export async function searchIntros(attendeeId: string, campfireId?: string): Promise<IStoredIntro[]> {
  const filter = [
    { bool: { should: [{ term: { fromId: attendeeId } }, { term: { toId: attendeeId } }], minimum_should_match: 1 } },
    ...(campfireId ? [{ term: { campfireId } }, { term: { status: 'accepted' } }] : []),
  ];

  const response = await getEsClient().search<IIntro>(
    {
      index: indexNames.INTROS,
      query: { bool: { filter } },
      sort: [{ proposedAt: { order: 'desc' } }],
      size: 50,
      seq_no_primary_term: true,
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.hits.hits.flatMap((hit) =>
    hit._source && hit._id && hit._seq_no !== undefined && hit._primary_term !== undefined
      ? [{ intro: { ...hit._source, id: hit._id }, seqNo: hit._seq_no, primaryTerm: hit._primary_term }]
      : [],
  );
}

const LIVE_QUERY_TIMEOUT_MS = 3000;

export async function searchLiveRequests(attendeeId: string, size: number): Promise<IStoredIntro[]> {
  const response = await getEsClient().search<IIntro>(
    {
      index: indexNames.INTROS,
      query: { bool: { filter: [{ term: { toId: attendeeId } }, { term: { status: 'proposed' } }, { term: { liveState: 'live' } }] } },
      sort: [{ proposedAt: { order: 'desc' } }],
      size,
      seq_no_primary_term: true,
      timeout: `${LIVE_QUERY_TIMEOUT_MS}ms`,
    },
    esOptions(LIVE_QUERY_TIMEOUT_MS),
  );

  return response.hits.hits.flatMap((hit) =>
    hit._source && hit._id && hit._seq_no !== undefined && hit._primary_term !== undefined
      ? [{ intro: { ...hit._source, id: hit._id }, seqNo: hit._seq_no, primaryTerm: hit._primary_term }]
      : [],
  );
}

export async function blockPlayer(attendee: IAttendee, blockedId: string): Promise<void> {
  if (attendee.blockedIds.includes(blockedId)) {
    return;
  }

  await getEsClient().update(
    { index: indexNames.ATTENDEES, id: attendee.id, doc: { blockedIds: [...attendee.blockedIds, blockedId] }, refresh: true },
    esOptions(esTimeouts.WRITE_MS),
  );
}
