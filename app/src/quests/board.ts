import { gameRules } from '../types/kubequest.constants';
import { IAttendee, IQuest, IQuestBoard } from '../types/kubequest.interfaces';
import { orderForIntent } from './intent';
import { generateCandidates, IOfferContext, pickOffers } from './offers';
import { noLocationHint } from './proximity';
import { deleteQuests, listEvents, listQuests, loadAttendee, loadLocation, saveQuests } from './store';
import { addMinutes, isAfter, startOfConferenceDay } from './time';

const REGENERATE_AFTER_MINUTES = 2;
const CLOSED_STATUSES = new Set(['declined', 'dropped', 'completed', 'expired']);

function isExpired(quest: IQuest, now: Date): boolean {
  return quest.expiresAt !== undefined && !isAfter(quest.expiresAt, now);
}

function snoozeOver(quest: IQuest, attendee: IAttendee, now: Date): boolean {
  if (quest.snoozedUntil !== undefined && !isAfter(quest.snoozedUntil, now)) {
    return true;
  }

  return attendee.lastSeenAt !== undefined && quest.respondedAt !== undefined && isAfter(attendee.lastSeenAt, new Date(quest.respondedAt));
}

function tidy(quests: IQuest[], attendee: IAttendee, now: Date): IQuest[] {
  const changed: IQuest[] = [];

  for (const quest of quests) {
    if ((quest.status === 'offered' || quest.status === 'accepted' || quest.status === 'not_now') && isExpired(quest, now)) {
      quest.status = 'expired';
      changed.push(quest);
    } else if (quest.status === 'not_now' && snoozeOver(quest, attendee, now)) {
      quest.status = 'offered';
      quest.snoozedUntil = undefined;
      changed.push(quest);
    }
  }

  return changed;
}

function needsRefresh(offers: IQuest[], attendee: IAttendee, now: Date): boolean {
  const newest = offers.reduce<string | undefined>((latest, quest) => (latest === undefined || quest.offeredAt > latest ? quest.offeredAt : latest), undefined);

  if (newest === undefined) {
    return true;
  }

  if (attendee.lastSeenAt !== undefined && attendee.lastSeenAt > newest) {
    return true;
  }

  return offers.length < gameRules.MAX_OFFERS && !isAfter(addMinutes(new Date(newest), REGENERATE_AFTER_MINUTES).toISOString(), now);
}

export async function buildBoard(attendeeId: string, now: Date = new Date(), forceRefresh = false): Promise<IQuestBoard> {
  const attendee = await loadAttendee(attendeeId);
  const dayStart = startOfConferenceDay(now);
  const [quests, allEvents, here] = await Promise.all([listQuests(attendeeId), listEvents(attendeeId), loadLocation(attendee.lastLocationId)]);
  const changed = tidy(quests, attendee, now);
  let offers = quests.filter((quest) => quest.status === 'offered');

  if (forceRefresh || needsRefresh(offers, attendee, now)) {
    const context: IOfferContext = {
      attendee,
      now,
      here,
      allEvents,
      eventsToday: allEvents.filter((event) => isAfter(event.at, dayStart) || event.at === dayStart.toISOString()),
      avoidFar: quests.some((quest) => quest.status === 'declined' && quest.declineReason === 'too_far'),
    };
    const known = new Map(quests.map((quest) => [quest.id, quest]));
    const candidates = (await generateCandidates(context)).filter((candidate) => {
      const existing = known.get(candidate.quest.id);

      return existing === undefined || existing.status === 'offered';
    });
    const fresh = pickOffers(candidates, gameRules.MAX_OFFERS).map((quest) => {
      const existing = known.get(quest.id);

      return existing ? { ...quest, offeredAt: existing.offeredAt } : quest;
    });
    const keep = new Set(fresh.map((quest) => quest.id));
    const stale = offers.filter((quest) => !keep.has(quest.id));
    const freshIds = new Set(fresh.map((quest) => quest.id));

    await deleteQuests(stale.map((quest) => quest.id));
    await saveQuests([...changed.filter((quest) => !freshIds.has(quest.id) && !stale.some((old) => old.id === quest.id)), ...fresh]);
    offers = fresh;
  } else {
    await saveQuests(changed);
  }

  const active = quests.filter((quest) => quest.status === 'accepted');
  const doneToday = quests.filter((quest) => quest.status === 'completed' && isAfter(quest.completedAt, dayStart));

  return {
    offers: orderForIntent(attendee, offers).slice(0, gameRules.MAX_OFFERS),
    active,
    doneToday,
    maxOffers: gameRules.MAX_OFFERS,
    maxActive: gameRules.MAX_ACTIVE_QUESTS,
    ...(attendee.lastLocationId ? {} : { nearHint: noLocationHint }),
  };
}

export function isClosed(quest: IQuest): boolean {
  return CLOSED_STATUSES.has(quest.status);
}
