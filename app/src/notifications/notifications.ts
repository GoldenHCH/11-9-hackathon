import type { estypes } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts } from '../es/es.constants';
import { IStoredNotification } from '../types/internal.interfaces';
import {
  IListNotificationsInput,
  IListNotificationsResult,
  IMarkNotificationsReadInput,
  IMarkNotificationsReadResult,
  INotification,
} from '../types/kubequest.interfaces';
import { NotificationType } from '../types/kubequest.types';
import { notificationRules } from './notifications.constants';
import { notificationDocId } from './notify';

function ownerFilter(attendeeId: string): estypes.QueryDslQueryContainer[] {
  return [{ term: { kind: notificationRules.KIND } }, { term: { attendeeId } }];
}

function unreadQuery(attendeeId: string): estypes.QueryDslQueryContainer {
  return { bool: { filter: ownerFilter(attendeeId), must_not: [{ exists: { field: 'readAt' } }] } };
}

function viewNotification(stored: IStoredNotification): INotification {
  return {
    id: stored.dedupeKey,
    type: stored.type,
    title: stored.title,
    body: stored.body,
    link: stored.link,
    createdAt: stored.createdAt,
    readAt: stored.readAt ?? null,
  };
}

async function unreadCount(attendeeId: string): Promise<number> {
  const response = await getEsClient().count(
    { index: notificationRules.INDEX, query: unreadQuery(attendeeId) },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return response.count ?? 0;
}

async function unreadKeys(attendeeId: string): Promise<string[]> {
  const response = await getEsClient().search<Pick<IStoredNotification, 'dedupeKey'>>(
    { index: notificationRules.INDEX, size: notificationRules.MARK_MAX, query: unreadQuery(attendeeId), _source: ['dedupeKey'] },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return (response.hits?.hits ?? []).flatMap((hit) => (hit._source?.dedupeKey ? [hit._source.dedupeKey] : []));
}

export async function recentNotificationCount(attendeeId: string, type: NotificationType, since: Date): Promise<number> {
  const response = await getEsClient().count(
    {
      index: notificationRules.INDEX,
      query: { bool: { filter: [...ownerFilter(attendeeId), { term: { type } }, { range: { createdAt: { gte: since.toISOString() } } }] } },
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return response.count ?? 0;
}

export async function listNotifications(input: IListNotificationsInput): Promise<IListNotificationsResult> {
  const [response, unread] = await Promise.all([
    getEsClient().search<IStoredNotification>(
      {
        index: notificationRules.INDEX,
        size: input.limit ?? notificationRules.LIST_DEFAULT,
        query: { bool: { filter: ownerFilter(input.attendeeId) } },
        sort: [{ createdAt: { order: 'desc' } }],
      },
      { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
    ),
    unreadCount(input.attendeeId),
  ]);
  const items = (response.hits?.hits ?? []).flatMap((hit) => (hit._source ? [viewNotification(hit._source)] : []));
  trace.getActiveSpan()?.setAttributes({ 'kubequest.notification.count': items.length, 'kubequest.notification.unread': unread });

  return { items, unread };
}

export async function markNotificationsRead(input: IMarkNotificationsReadInput): Promise<IMarkNotificationsReadResult> {
  const keys = input.all ? await unreadKeys(input.attendeeId) : [...new Set(input.ids ?? [])];

  if (keys.length === 0) {
    return { marked: 0, unread: await unreadCount(input.attendeeId) };
  }

  const readAt = new Date().toISOString();
  const response = await getEsClient().bulk(
    {
      refresh: 'wait_for',
      operations: keys.flatMap((key) => [
        { update: { _index: notificationRules.INDEX, _id: notificationDocId(input.attendeeId, key) } },
        { doc: { readAt } },
      ]),
    },
    esOptions(esTimeouts.WRITE_MS),
  );
  const marked = response.items.filter((item) => item.update?.result === 'updated' || item.update?.result === 'noop').length;
  trace.getActiveSpan()?.setAttribute('kubequest.notification.marked', marked);

  return { marked, unread: await unreadCount(input.attendeeId) };
}
