import { esOptions, getEsClient } from '../es/client';
import { indexNames } from '../es/es.constants';
import { getLocations, placeFor } from '../match/match-data';
import { acceptedMeets, acceptedQuests, handlesFor } from '../match/next';
import { logger } from '../observability/logger';
import { IGetItineraryInput, IIntro, IItinerary, IPlanItem, IQuest, IQuestPlace, ITalk } from '../types/kubequest.interfaces';
import { worldNow } from '../world/clock';
import { walkMinutes } from '../world/walk';
import { conferenceDayOf, minutesBetween, overlaps } from './day.helper';
import { itineraryRules, scheduleSourceFields } from './itinerary.constants';
import { readItinerary } from './itinerary.store';
import { checkedInCounts, toScheduleSession } from './schedule';

async function softly<T>(label: string, fallback: T, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    logger.warn({ err: error, part: label }, 'get_itinerary part failed');

    return fallback;
  }
}

async function talksByIds(ids: string[]): Promise<ITalk[]> {
  if (ids.length === 0) {
    return [];
  }

  const response = await getEsClient().mget<ITalk>(
    { index: indexNames.TALKS, ids, _source_includes: scheduleSourceFields },
    esOptions(),
  );

  return response.docs.flatMap((doc) => ('found' in doc && doc.found && doc._source ? [{ ...doc._source, id: doc._id }] : []));
}

function walkPoint(place: IQuestPlace | undefined): { id: string; building: string; level: string } | undefined {
  return place ? { id: place.locationId, building: place.building, level: place.level } : undefined;
}

function talkItems(talks: ITalk[], counts: Map<string, number>, questByTalk: Map<string, IQuest>, nowMs: number): IPlanItem[] {
  return talks.map((talk) => ({
    id: `talk:${talk.id}`,
    kind: 'talk',
    title: talk.title,
    start: talk.start,
    end: talk.end,
    place: placeFor(undefined, talk),
    conflictsWith: [],
    talkId: talk.id,
    questId: questByTalk.get(talk.id)?.id,
    session: toScheduleSession(talk, counts.get(talk.id) ?? 0, true),
    quizAvailable: Date.parse(talk.start) <= nowMs,
  }));
}

function questItems(quests: IQuest[], plannedIds: Set<string>): IPlanItem[] {
  return quests
    .filter((quest) => quest.when?.start && !(quest.talkId && plannedIds.has(quest.talkId)))
    .map((quest) => ({
      id: `quest:${quest.id}`,
      kind: 'quest',
      title: quest.title,
      start: quest.when?.start ?? quest.offeredAt,
      end: quest.when?.end,
      place: quest.where,
      conflictsWith: [],
      talkId: quest.talkId,
      questId: quest.id,
    }));
}

async function meetItems(attendeeId: string, meets: IIntro[]): Promise<IPlanItem[]> {
  const timed = meets.filter((meet) => meet.slot?.start);
  const partnerIds = timed.map((meet) => (meet.fromId === attendeeId ? meet.toId : meet.fromId));
  const [locations, handles] = await Promise.all([
    softly('campfires', new Map(), () => getLocations(timed.map((meet) => meet.campfireId ?? ''))),
    softly('handles', new Map<string, string>(), () => handlesFor(partnerIds)),
  ]);

  return timed.map((meet, index) => {
    const handle = handles.get(partnerIds[index]);

    return {
      id: `meet:${meet.id}`,
      kind: 'meet',
      title: handle ? `Meet @${handle}` : 'Hallway meet',
      start: meet.slot?.start ?? meet.proposedAt,
      end: meet.slot?.end,
      place: placeFor(locations.get(meet.campfireId ?? '')),
      conflictsWith: [],
      meetId: meet.id,
    };
  });
}

function markConflicts(items: IPlanItem[]): number {
  let conflictCount = 0;

  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
      const left = items[leftIndex];
      const right = items[rightIndex];

      if (overlaps(left, right)) {
        left.conflictsWith.push(right.id);
        right.conflictsWith.push(left.id);
        conflictCount += 1;
      }
    }
  }

  return conflictCount;
}

function withWalksAndGaps(items: IPlanItem[]): IPlanItem[] {
  const result: IPlanItem[] = [];
  let previous: IPlanItem | undefined;
  let latestEnd: string | undefined;

  for (const item of items) {
    const sameDay = previous !== undefined && conferenceDayOf(new Date(previous.start)) === conferenceDayOf(new Date(item.start));

    if (previous && sameDay) {
      const minutes = walkMinutes(walkPoint(previous.place), walkPoint(item.place));

      if (minutes !== undefined) {
        item.walkMinutes = minutes;
        item.walkFrom = previous.place?.name;
      }

      if (latestEnd) {
        const gapMinutes = minutesBetween(latestEnd, item.start);

        if (gapMinutes >= itineraryRules.MIN_GAP_MINUTES) {
          result.push({ id: `gap:${latestEnd}`, kind: 'gap', title: `${gapMinutes} min free`, start: latestEnd, end: item.start, gapMinutes, conflictsWith: [] });
        }
      }
    }

    if (!sameDay) {
      latestEnd = undefined;
    }

    const itemEnd = item.end ?? item.start;
    latestEnd = !latestEnd || Date.parse(itemEnd) > Date.parse(latestEnd) ? itemEnd : latestEnd;
    result.push(item);
    previous = item;
  }

  return result;
}

export async function getItinerary(input: IGetItineraryInput): Promise<IItinerary> {
  const now = worldNow();
  const nowMs = now.getTime();
  const entries = await readItinerary(input.attendeeId);
  const plannedIds = new Set(entries.map((entry) => entry.talkId));

  const [talks, quests, meets, counts] = await Promise.all([
    talksByIds([...plannedIds]),
    softly('quests', [], () => acceptedQuests(input.attendeeId)),
    softly('meets', [], () => acceptedMeets(input.attendeeId, new Date(nowMs - 24 * 3600000).toISOString())),
    checkedInCounts([...plannedIds]),
  ]);

  const questByTalk = new Map(quests.flatMap((quest) => (quest.talkId ? [[quest.talkId, quest] as const] : [])));
  const items = [
    ...talkItems(talks, counts, questByTalk, nowMs),
    ...questItems(quests, plannedIds),
    ...(await meetItems(input.attendeeId, meets)),
  ]
    .filter((item) => !input.day || conferenceDayOf(new Date(item.start)) === input.day)
    .sort((left, right) => Date.parse(left.start) - Date.parse(right.start));

  const conflictCount = markConflicts(items);

  for (const item of items) {
    item.isNow = Date.parse(item.start) <= nowMs && nowMs < Date.parse(item.end ?? item.start);
  }

  return {
    now: now.toISOString(),
    ...(input.day ? { day: input.day } : {}),
    plannedCount: entries.length,
    maxItems: itineraryRules.MAX_ITEMS,
    conflictCount,
    items: withWalksAndGaps(items),
  };
}
