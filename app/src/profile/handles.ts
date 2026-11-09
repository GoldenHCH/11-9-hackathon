import { errors } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { ToolError } from '../tools/tool-errors';

export const handleReservations = {
  INDEX: indexNames.MESSAGES,
  ID_PREFIX: 'handle:',
  KIND: 'handle_reservation',
} as const;

interface IHandleReservation {
  kind: string;
  handle: string;
  attendeeId: string;
  createdAt: string;
}

function hasStatus(error: unknown, statusCode: number): boolean {
  return error instanceof errors.ResponseError && error.statusCode === statusCode;
}

export function handleKey(handle: string): string {
  return handle.trim().toLowerCase();
}

export function reservationId(handle: string): string {
  return `${handleReservations.ID_PREFIX}${handleKey(handle)}`;
}

export function reservationFor(handle: string, attendeeId: string): IHandleReservation {
  return { kind: handleReservations.KIND, handle: handleKey(handle), attendeeId, createdAt: new Date().toISOString() };
}

async function reservationOwner(handle: string): Promise<string | undefined> {
  try {
    const response = await getEsClient().get<IHandleReservation>({ index: handleReservations.INDEX, id: reservationId(handle) }, esOptions(esTimeouts.DEFAULT_MS));

    return response._source?.attendeeId;
  } catch (error) {
    if (hasStatus(error, 404)) {
      return undefined;
    }

    throw error;
  }
}

async function heldByAnotherAttendee(handle: string, attendeeId: string): Promise<boolean> {
  const response = await getEsClient().count(
    {
      index: indexNames.ATTENDEES,
      query: { bool: { filter: [{ term: { handle: handleKey(handle) } }], must_not: [{ ids: { values: [attendeeId] } }] } },
    },
    esOptions(esTimeouts.DEFAULT_MS),
  );

  return response.count > 0;
}

export async function reserveHandle(handle: string, attendeeId: string): Promise<boolean> {
  const key = handleKey(handle);

  try {
    await getEsClient().create(
      { index: handleReservations.INDEX, id: reservationId(key), document: reservationFor(key, attendeeId) },
      esOptions(esTimeouts.WRITE_MS),
    );
  } catch (error) {
    if (!hasStatus(error, 409)) {
      throw error;
    }

    return (await reservationOwner(key)) === attendeeId;
  }

  if (await heldByAnotherAttendee(key, attendeeId)) {
    await releaseHandle(key, attendeeId);

    return false;
  }

  return true;
}

export async function claimHandle(handle: string, attendeeId: string): Promise<void> {
  if (!(await reserveHandle(handle, attendeeId))) {
    throw new ToolError(409, 'handle_taken', `The handle "${handleKey(handle)}" is taken. Try another one.`);
  }
}

export async function releaseHandle(handle: string, attendeeId: string): Promise<void> {
  const key = handleKey(handle);

  try {
    if ((await reservationOwner(key)) !== attendeeId) {
      return;
    }

    await getEsClient().delete({ index: handleReservations.INDEX, id: reservationId(key) }, esOptions(esTimeouts.WRITE_MS));
  } catch (error) {
    if (!hasStatus(error, 404)) {
      throw error;
    }
  }
}

export async function releaseQuietly(handle: string, attendeeId: string): Promise<void> {
  try {
    await releaseHandle(handle, attendeeId);
  } catch {
    return;
  }
}
