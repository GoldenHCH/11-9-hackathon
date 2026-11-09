import { createHash } from 'node:crypto';
import { trace } from '@opentelemetry/api';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts } from '../es/es.constants';
import { getAttendee } from '../meet/meet.store';
import { logger } from '../observability/logger';
import { bannerCatalog } from '../types/kubequest.constants';
import { INotificationDraft, IStoredNotification } from '../types/internal.interfaces';
import { IAttendee, IIntro } from '../types/kubequest.interfaces';
import { BannerId } from '../types/kubequest.types';
import { notificationLinks, notificationRules } from './notifications.constants';

export function notificationDocId(attendeeId: string, dedupeKey: string): string {
  return `${notificationRules.ID_PREFIX}${attendeeId}:${dedupeKey}`;
}

export function hashedKey(prefix: string, value: string): string {
  return `${prefix}:${createHash('sha256').update(value).digest('hex').slice(0, notificationRules.KEY_HASH_LENGTH)}`;
}

function isConflict(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'statusCode') === 409;
}

export async function createNotification(attendeeId: string, draft: INotificationDraft): Promise<boolean> {
  const document: IStoredNotification = {
    kind: notificationRules.KIND,
    attendeeId,
    type: draft.type,
    title: draft.title,
    body: draft.body,
    link: draft.link,
    dedupeKey: draft.dedupeKey,
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  try {
    await getEsClient().index(
      { index: notificationRules.INDEX, id: notificationDocId(attendeeId, draft.dedupeKey), document, op_type: 'create' },
      esOptions(esTimeouts.WRITE_MS),
    );
    trace.getActiveSpan()?.addEvent('notification.created', { 'kubequest.notification.type': draft.type });

    return true;
  } catch (error) {
    if (isConflict(error)) {
      return false;
    }

    throw error;
  }
}

async function notifySafely(attendeeId: string, draft: INotificationDraft): Promise<void> {
  try {
    await createNotification(attendeeId, draft);
  } catch (error) {
    logger.warn({ err: error, type: draft.type }, 'notification not saved');
  }
}

export async function notifyMeetOffer(intro: IIntro, proposerHandle: string): Promise<void> {
  await notifySafely(intro.toId, {
    type: 'meet_offer',
    title: 'Someone nearby wants to meet you',
    body: `@${proposerHandle} wants to meet. Accept to get a time and a place.`,
    link: `${notificationLinks.MEET_PREFIX}${intro.id}`,
    dedupeKey: hashedKey('meet_offer', `${intro.id}|${intro.proposedAt}`),
  });
}

export async function notifyMeetAccepted(intro: IIntro): Promise<void> {
  if (intro.status !== 'accepted') {
    return;
  }

  try {
    const [first, second] = await Promise.all([getAttendee(intro.fromId), getAttendee(intro.toId)]);
    const pairs: [IAttendee, IAttendee][] = [
      [first, second],
      [second, first],
    ];

    await Promise.all(
      pairs.map(([recipient, partner]) =>
        notifySafely(recipient.id, {
          type: 'meet_accepted',
          title: 'Your meet is on',
          body: `You and @${partner.handle} both said yes. Open the meet for the time and the meeting point.`,
          link: `${notificationLinks.MEET_PREFIX}${intro.id}`,
          dedupeKey: hashedKey('meet_accepted', intro.id),
        }),
      ),
    );
  } catch (error) {
    logger.warn({ err: error }, 'meet accepted notifications skipped');
  }
}

export async function notifyBanner(attendeeId: string, banner: BannerId): Promise<void> {
  const definition = bannerCatalog[banner];

  await notifySafely(attendeeId, {
    type: 'banner',
    title: `New banner: ${definition.name}`,
    body: definition.description,
    link: notificationLinks.PROFILE,
    dedupeKey: `banner:${banner}`,
  });
}
