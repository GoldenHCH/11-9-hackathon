import { randomUUID } from 'node:crypto';
import { trace } from '@opentelemetry/api';
import { esOptions, getEsClient } from '../es/client';
import { kindIsOrLegacy } from '../es/doc-kind.helper';
import { esTimeouts, indexNames } from '../es/es.constants';
import { docKinds } from '../types/connections.constants';
import { getAttendee, getIntro } from '../meet/meet.store';
import { kubequestMetrics } from '../observability/metrics';
import { ToolError } from '../tools/tool-errors';
import { gameRules } from '../types/kubequest.constants';
import { IStoredMessage } from '../types/internal.interfaces';
import { IIntro, IListMessagesInput, IMessage, ISendMessageInput } from '../types/kubequest.interfaces';

const RATE_WINDOW_MS = 10 * 60_000;
const LIST_SIZE = 200;

function viewMessage(message: IStoredMessage, viewerId: string): IMessage {
  return { id: message.id, meetId: message.meetId, fromMe: message.fromId === viewerId, text: message.text, at: message.at };
}

async function partyMeet(meetId: string, attendeeId: string): Promise<IIntro> {
  const stored = await getIntro(meetId);

  if (!stored || (stored.intro.fromId !== attendeeId && stored.intro.toId !== attendeeId)) {
    throw new ToolError(404, 'unknown_meet', 'That meet is not yours or no longer exists.');
  }

  return stored.intro;
}

function bothAccepted(intro: IIntro): boolean {
  return intro.status === 'accepted' || intro.status === 'met';
}

async function sentRecently(attendeeId: string, now: Date): Promise<number> {
  const response = await getEsClient().count(
    {
      index: indexNames.MESSAGES,
      query: {
        bool: { filter: [{ term: { fromId: attendeeId } }, kindIsOrLegacy(docKinds.CHAT), { range: { at: { gte: new Date(now.getTime() - RATE_WINDOW_MS).toISOString() } } }] },
      },
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return response.count ?? 0;
}

export async function sendMessage(input: ISendMessageInput): Promise<IMessage> {
  const intro = await partyMeet(input.meetId, input.attendeeId);

  if (!bothAccepted(intro)) {
    throw new ToolError(409, 'meet_not_accepted', 'You can message each other once you both accept the meet.');
  }

  const partnerId = intro.fromId === input.attendeeId ? intro.toId : intro.fromId;
  const [sender, partner] = await Promise.all([getAttendee(input.attendeeId), getAttendee(partnerId)]);

  if (sender.blockedIds.includes(partner.id) || partner.blockedIds.includes(sender.id)) {
    throw new ToolError(409, 'no_match', 'Messages are off for this meet.');
  }

  const text = input.text.trim();

  if (text === '') {
    throw new ToolError(400, 'invalid_input', 'That request is missing something: text: write a message first');
  }

  const now = new Date();

  if ((await sentRecently(sender.id, now)) >= gameRules.MESSAGES_PER_TEN_MINUTES) {
    throw new ToolError(429, 'slow_down', 'You are sending messages fast. Take a breath and try again in a few minutes.');
  }

  const message: IStoredMessage = { kind: docKinds.CHAT, id: randomUUID(), meetId: intro.id, fromId: sender.id, toId: partner.id, text, at: now.toISOString() };
  await getEsClient().index({ index: indexNames.MESSAGES, id: message.id, document: message, refresh: 'wait_for' }, esOptions(esTimeouts.WRITE_MS));
  kubequestMetrics().messages.add(1, { 'kubequest.meet.status': intro.status });
  trace.getActiveSpan()?.setAttributes({ 'kubequest.message.id': message.id, 'kubequest.message.chars': text.length });

  return viewMessage(message, sender.id);
}

export async function listMessages(input: IListMessagesInput): Promise<IMessage[]> {
  const intro = await partyMeet(input.meetId, input.attendeeId);
  const response = await getEsClient().search<IStoredMessage>(
    {
      index: indexNames.MESSAGES,
      size: LIST_SIZE,
      query: { bool: { filter: [{ term: { meetId: intro.id } }, kindIsOrLegacy(docKinds.CHAT), ...(input.since ? [{ range: { at: { gt: input.since } } }] : [])] } },
      sort: [{ at: { order: 'asc' } }],
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );
  const messages = (response.hits?.hits ?? []).flatMap((hit) => (hit._source ? [viewMessage(hit._source, input.attendeeId)] : []));
  trace.getActiveSpan()?.setAttribute('kubequest.message.count', messages.length);

  return messages;
}
