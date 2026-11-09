import { errors } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { ToolError } from '../tools/tool-errors';
import { IAttendee } from '../types/kubequest.interfaces';

function isNotFound(error: unknown): boolean {
  return error instanceof errors.ResponseError && error.statusCode === 404;
}

export async function findAttendee(attendeeId: string): Promise<IAttendee | undefined> {
  try {
    const response = await getEsClient().get<IAttendee>({ index: indexNames.ATTENDEES, id: attendeeId }, esOptions(esTimeouts.DEFAULT_MS));

    return response._source ? { ...response._source, id: response._id } : undefined;
  } catch (error) {
    if (isNotFound(error)) {
      return undefined;
    }

    throw error;
  }
}

export async function getAttendee(attendeeId: string): Promise<IAttendee> {
  const attendee = await findAttendee(attendeeId);

  if (!attendee) {
    throw new ToolError(404, 'unknown_attendee', 'We could not find that player. Open your personal link or sign up again.');
  }

  return attendee;
}

export async function handleTaken(handle: string): Promise<boolean> {
  const response = await getEsClient().count(
    { index: indexNames.ATTENDEES, query: { term: { handle } } },
    esOptions(esTimeouts.DEFAULT_MS),
  );

  return response.count > 0;
}

export async function createAttendee(attendee: IAttendee): Promise<void> {
  await getEsClient().create(
    { index: indexNames.ATTENDEES, id: attendee.id, document: attendee, refresh: 'wait_for' },
    esOptions(esTimeouts.INFERENCE_MS),
  );
}

export async function patchAttendee(attendeeId: string, patch: Partial<IAttendee>): Promise<void> {
  await getEsClient().update(
    { index: indexNames.ATTENDEES, id: attendeeId, doc: patch, refresh: 'wait_for' },
    esOptions(esTimeouts.INFERENCE_MS),
  );
}

export function buildProfileText(input: {
  handle: string;
  workingOn: string;
  topics: string[];
  firstTimer: boolean;
  welcomer: boolean;
  languages?: string[];
  bio?: string;
}): string {
  const parts = [
    `${input.handle} is ${input.firstTimer ? 'at their first KubeCon' : 'a returning KubeCon attendee'}.`,
    input.workingOn.trim() !== '' ? `Working on: ${input.workingOn.trim()}.` : '',
    input.topics.length > 0 ? `Interested in ${input.topics.join(', ')}.` : '',
    input.languages && input.languages.length > 0 ? `Writes ${input.languages.join(', ')}.` : '',
    input.bio ? `About: ${input.bio}.` : '',
    input.welcomer ? 'Happy to welcome a first-timer.' : '',
  ];

  return parts.filter((part) => part !== '').join(' ');
}
