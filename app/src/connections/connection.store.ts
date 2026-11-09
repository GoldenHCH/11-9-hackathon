import { createHash } from 'node:crypto';
import { esOptions, getEsClient } from '../es/client';
import { kindIs } from '../es/doc-kind.helper';
import { esTimeouts, indexNames } from '../es/es.constants';
import { isConflict } from '../meet/meet.store';
import { IConnectionNote, IStoredConnection, IStoredConnectionNote } from '../types/connections.interfaces';
import { docKinds } from '../types/connections.constants';

export interface IVersionedConnection {
  connection: IStoredConnection;
  seqNo: number;
  primaryTerm: number;
}

const LIST_SIZE = 200;

export function connectionIdFor(firstId: string, secondId: string): string {
  const [low, high] = [firstId, secondId].sort();

  return `conn-${createHash('sha256').update(`connection:${low}|${high}`).digest('hex').slice(0, 24)}`;
}

export function connectionNoteIdFor(attendeeId: string, connectionId: string): string {
  return `cn-${createHash('sha256').update(`connection-note:${attendeeId}:${connectionId}`).digest('hex').slice(0, 24)}`;
}

export async function getConnection(connectionId: string): Promise<IVersionedConnection | undefined> {
  const response = await getEsClient().get<IStoredConnection>(
    { index: indexNames.MESSAGES, id: connectionId },
    { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] },
  );

  if (!response.found || !response._source || response._source.kind !== docKinds.CONNECTION || response._seq_no === undefined || response._primary_term === undefined) {
    return undefined;
  }

  return { connection: { ...response._source, id: connectionId }, seqNo: response._seq_no, primaryTerm: response._primary_term };
}

export async function createConnection(connection: IStoredConnection): Promise<boolean> {
  try {
    await getEsClient().index(
      { index: indexNames.MESSAGES, id: connection.id, document: connection, op_type: 'create', refresh: 'wait_for' },
      esOptions(esTimeouts.WRITE_MS),
    );

    return true;
  } catch (error) {
    if (isConflict(error)) {
      return false;
    }

    throw error;
  }
}

export async function replaceConnection(stored: IVersionedConnection, connection: IStoredConnection): Promise<void> {
  await getEsClient().index(
    {
      index: indexNames.MESSAGES,
      id: connection.id,
      document: connection,
      if_seq_no: stored.seqNo,
      if_primary_term: stored.primaryTerm,
      refresh: 'wait_for',
    },
    esOptions(esTimeouts.WRITE_MS),
  );
}

export async function searchConnections(attendeeId: string): Promise<IStoredConnection[]> {
  const response = await getEsClient().search<IStoredConnection>(
    {
      index: indexNames.MESSAGES,
      size: LIST_SIZE,
      query: { bool: { filter: [kindIs(docKinds.CONNECTION), { term: { memberIds: attendeeId } }] } },
      sort: [{ metAt: { order: 'desc' } }],
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return (response.hits?.hits ?? []).flatMap((hit) => (hit._source && hit._id ? [{ ...hit._source, id: hit._id }] : []));
}

export async function getConnectionNotes(attendeeId: string, connectionIds: string[]): Promise<Map<string, IConnectionNote>> {
  const notes = new Map<string, IConnectionNote>();

  if (connectionIds.length === 0) {
    return notes;
  }

  const response = await getEsClient().mget<IStoredConnectionNote>(
    { index: indexNames.MESSAGES, ids: connectionIds.map((connectionId) => connectionNoteIdFor(attendeeId, connectionId)) },
    esOptions(esTimeouts.DEFAULT_MS),
  );

  for (const doc of response.docs) {
    if ('found' in doc && doc.found && doc._source?.kind === docKinds.CONNECTION_NOTE && doc._source.attendeeId === attendeeId) {
      notes.set(doc._source.connectionId, doc._source.detail);
    }
  }

  return notes;
}

export async function writeConnectionNote(attendeeId: string, connectionId: string, detail: IConnectionNote): Promise<void> {
  const note: IStoredConnectionNote = {
    id: connectionNoteIdFor(attendeeId, connectionId),
    kind: docKinds.CONNECTION_NOTE,
    attendeeId,
    connectionId,
    updatedAt: detail.updatedAt,
    detail,
  };

  await getEsClient().index({ index: indexNames.MESSAGES, id: note.id, document: note, refresh: 'wait_for' }, esOptions(esTimeouts.WRITE_MS));
}
