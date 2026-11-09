import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { startOfConferenceDay } from '../quests/time';
import { toolRegistry } from '../tools';
import { INotificationDraft } from '../types/internal.interfaces';
import { IPersonMatch, IQuest } from '../types/kubequest.interfaces';
import { NotificationType } from '../types/kubequest.types';
import { notificationLinks, nudgeRules } from './notifications.constants';
import { recentNotificationCount } from './notifications';
import { createNotification, hashedKey } from './notify';

export interface INudgeCounts {
  players: number;
  questNotifications: number;
  matchNotifications: number;
  failures: number;
}

export async function activeAttendeeIds(now: Date = new Date()): Promise<string[]> {
  const seenSince = new Date(now.getTime() - nudgeRules.SEEN_WITHIN_MINUTES * 60_000).toISOString();
  const response = await getEsClient().search(
    {
      index: indexNames.ATTENDEES,
      size: nudgeRules.MAX_PLAYERS,
      _source: false,
      query: {
        bool: {
          should: [{ range: { lastSeenAt: { gte: seenSince } } }, { range: { createdAt: { gte: startOfConferenceDay(now).toISOString() } } }],
          minimum_should_match: 1,
        },
      },
      sort: [{ lastSeenAt: { order: 'desc', missing: '_last', unmapped_type: 'date' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.hits.hits.flatMap((hit) => (hit._id ? [hit._id] : []));
}

function questDraft(quest: IQuest): INotificationDraft {
  return {
    type: 'new_quest',
    title: `New quest: ${quest.title}`,
    body: quest.reason,
    link: notificationLinks.QUESTS,
    dedupeKey: hashedKey('quest', quest.id),
  };
}

function matchDraft(match: IPersonMatch): INotificationDraft {
  const topic = match.sharedTopics[0] ?? match.player.topics[0] ?? nudgeRules.DEFAULT_TOPIC;

  return {
    type: 'new_match',
    title: `You and @${match.player.handle} both work on ${topic}`,
    body: match.reason,
    link: notificationLinks.PEOPLE,
    dedupeKey: `match:${match.player.id}`,
  };
}

async function createUpTo(attendeeId: string, drafts: INotificationDraft[], limit: number): Promise<number> {
  let created = 0;

  for (const draft of drafts) {
    if (created >= limit) {
      break;
    }

    if (await createNotification(attendeeId, draft)) {
      created += 1;
    }
  }

  return created;
}

async function roomLeft(attendeeId: string, type: NotificationType, perWindow: number, windowMinutes: number, now: Date): Promise<number> {
  const recent = await recentNotificationCount(attendeeId, type, new Date(now.getTime() - windowMinutes * 60_000));

  return Math.max(0, perWindow - recent);
}

async function nudgePlayer(attendeeId: string, counts: INudgeCounts, now: Date): Promise<void> {
  try {
    const questRoom = await roomLeft(attendeeId, 'new_quest', nudgeRules.QUESTS_PER_RUN, nudgeRules.QUEST_WINDOW_MINUTES, now);

    if (questRoom > 0) {
      const board = await toolRegistry.quest_board.execute({ attendeeId });
      counts.questNotifications += await createUpTo(attendeeId, board.offers.map(questDraft), questRoom);
    }
  } catch (error) {
    counts.failures += 1;
    console.warn(`nudge: quests for one player failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  try {
    const matchRoom = await roomLeft(attendeeId, 'new_match', nudgeRules.MATCHES_PER_RUN, nudgeRules.MATCH_WINDOW_MINUTES, now);

    if (matchRoom > 0) {
      const matches = await toolRegistry.recommend_people.execute({ attendeeId, limit: nudgeRules.MATCH_CANDIDATES });
      counts.matchNotifications += await createUpTo(attendeeId, matches.map(matchDraft), matchRoom);
    }
  } catch (error) {
    counts.failures += 1;
    console.warn(`nudge: matches for one player failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function runNudge(now: Date = new Date()): Promise<INudgeCounts> {
  const attendeeIds = await activeAttendeeIds(now);
  const counts: INudgeCounts = { players: attendeeIds.length, questNotifications: 0, matchNotifications: 0, failures: 0 };
  const queue = [...attendeeIds];
  const workers = Array.from({ length: nudgeRules.CONCURRENCY }, async () => {
    for (let attendeeId = queue.shift(); attendeeId !== undefined; attendeeId = queue.shift()) {
      await nudgePlayer(attendeeId, counts, now);
    }
  });

  await Promise.all(workers);

  return counts;
}
