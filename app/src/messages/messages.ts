import { randomUUID } from 'node:crypto';
import type { estypes } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { toPublicPlayer } from '../exhibitors/visits';
import { getAttendee, getIntro, searchIntros } from '../meet/meet.store';
import { kubequestMetrics } from '../observability/metrics';
import { ToolError } from '../tools/tool-errors';
import { gameRules } from '../types/kubequest.constants';
import { IStoredMessage, IStoredReadMarker } from '../types/internal.interfaces';
import {
  IAttendee,
  IConversation,
  IConversationPreview,
  IIntro,
  IListConversationsResult,
  IListMessagesInput,
  IMarkConversationReadInput,
  IMarkConversationReadResult,
  IMessage,
  ISendMessageInput,
} from '../types/kubequest.interfaces';

const RATE_WINDOW_MS = 60_000;
const LIST_SIZE = 200;
const CHAT_KIND = 'chat';
const READ_MARKER_KIND = 'read_marker';
const READ_MARKER_PREFIX = 'read:';
const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​-‏‪-‮⁦-⁩]/g;
const EXTRA_BLANK_LINES = /\n{3,}/g;

interface IConversationStats {
  last?: IStoredMessage;
  unread: number;
}

function chatKind(): estypes.QueryDslQueryContainer {
  return { bool: { should: [{ term: { kind: CHAT_KIND } }, { bool: { must_not: [{ exists: { field: 'kind' } }] } }], minimum_should_match: 1 } };
}

function chatOnly(): estypes.QueryDslQueryContainer[] {
  return [chatKind(), { exists: { field: 'meetId' } }, { exists: { field: 'fromId' } }];
}

function readMarkerId(attendeeId: string, meetId: string): string {
  return `${READ_MARKER_PREFIX}${attendeeId}:${meetId}`;
}

function plainText(raw: string): string {
  return raw.replace(/\r\n?/g, '\n').replace(CONTROL_CHARACTERS, '').replace(EXTRA_BLANK_LINES, '\n\n').trim();
}

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

function partnerOf(intro: IIntro, attendeeId: string): string {
  return intro.fromId === attendeeId ? intro.toId : intro.fromId;
}

function isBlocked(first: IAttendee, second: IAttendee): boolean {
  return (first.blockedIds ?? []).includes(second.id) || (second.blockedIds ?? []).includes(first.id);
}

async function sentRecently(attendeeId: string, now: Date): Promise<number> {
  const response = await getEsClient().count(
    {
      index: indexNames.MESSAGES,
      query: {
        bool: { filter: [...chatOnly(), { term: { fromId: attendeeId } }, { range: { at: { gte: new Date(now.getTime() - RATE_WINDOW_MS).toISOString() } } }] },
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

  const [sender, partner] = await Promise.all([getAttendee(input.attendeeId), getAttendee(partnerOf(intro, input.attendeeId))]);

  if (isBlocked(sender, partner)) {
    throw new ToolError(409, 'no_match', 'Messages are off for this meet.');
  }

  const text = plainText(input.text);

  if (text === '') {
    throw new ToolError(400, 'invalid_input', 'That request is missing something: text: write a message first');
  }

  const now = new Date();

  if ((await sentRecently(sender.id, now)) >= gameRules.MESSAGES_PER_MINUTE) {
    throw new ToolError(429, 'slow_down', 'You are sending messages fast. Take a breath and try again in a minute.');
  }

  const message: IStoredMessage = { kind: CHAT_KIND, id: randomUUID(), meetId: intro.id, fromId: sender.id, toId: partner.id, text, at: now.toISOString() };
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
      query: { bool: { filter: [...chatOnly(), { term: { meetId: intro.id } }, ...(input.since ? [{ range: { at: { gt: input.since } } }] : [])] } },
      sort: [{ at: { order: input.since ? 'asc' : 'desc' } }],
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );
  const messages = (response.hits?.hits ?? []).flatMap((hit) => (hit._source ? [viewMessage(hit._source, input.attendeeId)] : []));
  const ordered = input.since ? messages : messages.reverse();
  trace.getActiveSpan()?.setAttribute('kubequest.message.count', ordered.length);

  return ordered;
}

async function readMarkers(attendeeId: string, meetIds: string[]): Promise<Map<string, string>> {
  const markers = new Map<string, string>();

  if (meetIds.length === 0) {
    return markers;
  }

  const response = await getEsClient().mget<IStoredReadMarker>(
    { index: indexNames.MESSAGES, ids: meetIds.map((meetId) => readMarkerId(attendeeId, meetId)) },
    esOptions(esTimeouts.DEFAULT_MS),
  );

  for (const doc of response.docs) {
    if ('found' in doc && doc.found && doc._source?.kind === READ_MARKER_KIND && doc._source.attendeeId === attendeeId) {
      markers.set(doc._source.meetId, doc._source.readAt);
    }
  }

  return markers;
}

async function loadAttendees(ids: string[]): Promise<Map<string, IAttendee>> {
  const found = new Map<string, IAttendee>();
  const unique = [...new Set(ids)];

  if (unique.length === 0) {
    return found;
  }

  const response = await getEsClient().mget<IAttendee>({ index: indexNames.ATTENDEES, ids: unique }, esOptions(esTimeouts.DEFAULT_MS));

  for (const doc of response.docs) {
    if ('found' in doc && doc.found && doc._source) {
      found.set(doc._id, { ...doc._source, id: doc._id });
    }
  }

  return found;
}

async function conversationStats(attendeeId: string, meetIds: string[], markers: Map<string, string>): Promise<Map<string, IConversationStats>> {
  const stats = new Map<string, IConversationStats>(meetIds.map((meetId) => [meetId, { unread: 0 }]));

  if (meetIds.length === 0) {
    return stats;
  }

  const unreadFilters = Object.fromEntries(
    meetIds.map((meetId) => {
      const readAt = markers.get(meetId);

      return [meetId, { bool: { filter: [{ term: { meetId } }, { term: { toId: attendeeId } }, ...(readAt ? [{ range: { at: { gt: readAt } } }] : [])] } }];
    }),
  );
  const response = await getEsClient().search<IStoredMessage>(
    {
      index: indexNames.MESSAGES,
      size: 0,
      query: { bool: { filter: [...chatOnly(), { terms: { meetId: meetIds } }] } },
      aggs: {
        byMeet: {
          terms: { field: 'meetId', size: meetIds.length },
          aggs: { last: { top_hits: { size: 1, sort: [{ at: { order: 'desc' } }] } } },
        },
        unread: { filters: { filters: unreadFilters } },
      },
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );
  const aggregations = response.aggregations as
    | {
        byMeet?: { buckets: { key: string; last: { hits: { hits: { _source?: IStoredMessage }[] } } }[] };
        unread?: { buckets: Record<string, { doc_count: number }> };
      }
    | undefined;

  for (const bucket of aggregations?.byMeet?.buckets ?? []) {
    const entry = stats.get(bucket.key);
    const last = bucket.last.hits.hits[0]?._source;

    if (entry && last) {
      entry.last = last;
    }
  }

  for (const [meetId, bucket] of Object.entries(aggregations?.unread?.buckets ?? {})) {
    const entry = stats.get(meetId);

    if (entry) {
      entry.unread = bucket.doc_count;
    }
  }

  return stats;
}

function preview(message: IStoredMessage | undefined, viewerId: string): IConversationPreview | null {
  return message ? { text: message.text, fromMe: message.fromId === viewerId, at: message.at } : null;
}

function newestPerPartner(intros: IIntro[], attendeeId: string): IIntro[] {
  const byPartner = new Map<string, IIntro>();

  for (const intro of intros) {
    const partnerId = partnerOf(intro, attendeeId);
    const current = byPartner.get(partnerId);

    if (!current || Date.parse(intro.proposedAt) > Date.parse(current.proposedAt)) {
      byPartner.set(partnerId, intro);
    }
  }

  return [...byPartner.values()];
}

export async function listConversations(attendeeId: string): Promise<IListConversationsResult> {
  const viewer = await getAttendee(attendeeId);
  const intros = newestPerPartner(
    (await searchIntros(attendeeId)).map((stored) => stored.intro).filter(bothAccepted),
    attendeeId,
  );
  const partners = await loadAttendees(intros.map((intro) => partnerOf(intro, attendeeId)));
  const open = intros.filter((intro) => {
    const partner = partners.get(partnerOf(intro, attendeeId));

    return partner !== undefined && !isBlocked(viewer, partner);
  });
  const meetIds = open.map((intro) => intro.id);
  const markers = await readMarkers(attendeeId, meetIds);
  const stats = await conversationStats(attendeeId, meetIds, markers);
  const conversations: IConversation[] = open.flatMap((intro) => {
    const partner = partners.get(partnerOf(intro, attendeeId));

    if (!partner) {
      return [];
    }

    const card = toPublicPlayer(partner);
    const entry = stats.get(intro.id) ?? { unread: 0 };
    const lastMessage = preview(entry.last, attendeeId);

    return [
      {
        meetId: intro.id,
        meetStatus: intro.status,
        partner: { publicId: card.id, handle: card.handle, faceSeed: card.faceSeed, levelName: card.levelName },
        lastMessage,
        lastActivityAt: lastMessage?.at ?? intro.respondedAt ?? intro.proposedAt,
        unread: entry.unread,
      },
    ];
  });
  conversations.sort((first, second) => Date.parse(second.lastActivityAt) - Date.parse(first.lastActivityAt));
  const unread = conversations.reduce((total, conversation) => total + conversation.unread, 0);
  trace.getActiveSpan()?.setAttributes({ 'kubequest.conversation.count': conversations.length, 'kubequest.message.unread': unread });

  return { conversations, unread };
}

export async function markConversationRead(input: IMarkConversationReadInput): Promise<IMarkConversationReadResult> {
  const intro = await partyMeet(input.meetId, input.attendeeId);
  const readAt = new Date().toISOString();
  const marker: IStoredReadMarker = { kind: READ_MARKER_KIND, attendeeId: input.attendeeId, meetId: intro.id, readAt };
  await getEsClient().index(
    { index: indexNames.MESSAGES, id: readMarkerId(input.attendeeId, intro.id), document: marker, refresh: 'wait_for' },
    esOptions(esTimeouts.WRITE_MS),
  );
  const { unread } = await listConversations(input.attendeeId);

  return { meetId: intro.id, readAt, unread };
}
