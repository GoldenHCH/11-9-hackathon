import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { IAttendee, IIntro, IItineraryItem, IQuest, IWhatsNext } from '../types/kubequest.interfaces';
import { walkMinutes } from '../world/walk';
import { getAttendee, getLocations, hitSources, locationWalkPoint, placeFor } from './match-data';
import { recommendTalksFor } from './talks';

const nextWindowMinutes = 180;
const nowCardLeadMinutes = 15;

async function acceptedQuests(attendeeId: string): Promise<IQuest[]> {
  const response = await getEsClient().search<IQuest>(
    {
      index: indexNames.QUESTS,
      size: 20,
      query: { bool: { filter: [{ term: { attendeeId } }, { term: { status: 'accepted' } }] } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return hitSources(response.hits.hits);
}

async function acceptedMeets(attendeeId: string, nowIso: string): Promise<IIntro[]> {
  const response = await getEsClient().search<IIntro>(
    {
      index: indexNames.INTROS,
      size: 20,
      query: {
        bool: {
          filter: [
            { term: { status: 'accepted' } },
            { bool: { should: [{ term: { fromId: attendeeId } }, { term: { toId: attendeeId } }], minimum_should_match: 1 } },
            { range: { expiresAt: { gte: nowIso } } },
          ],
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return hitSources(response.hits.hits);
}

async function handlesFor(ids: string[]): Promise<Map<string, string>> {
  const handles = new Map<string, string>();

  if (ids.length === 0) {
    return handles;
  }

  const response = await getEsClient().mget<IAttendee>(
    { index: indexNames.ATTENDEES, ids: [...new Set(ids)], _source_includes: ['handle'] },
    esOptions(),
  );

  for (const doc of response.docs) {
    if ('found' in doc && doc.found && doc._source) {
      handles.set(doc._id, doc._source.handle);
    }
  }

  return handles;
}

async function softly<T>(label: string, fallback: T, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    logger.warn({ err: error, part: label }, 'whats_next part failed');
    return fallback;
  }
}

export async function whatsNext(attendeeId: string): Promise<IWhatsNext> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const me = await getAttendee(attendeeId);

  const [talkMatches, quests, meets] = await Promise.all([
    softly('talks', [], () => recommendTalksFor(attendeeId, { limit: 1, withinMinutes: nextWindowMinutes })),
    softly('quests', [], () => acceptedQuests(attendeeId)),
    softly('meets', [], () => acceptedMeets(attendeeId, nowIso)),
  ]);

  const partnerIds = meets.map((meet) => (meet.fromId === attendeeId ? meet.toId : meet.fromId));
  const [locations, handles] = await Promise.all([
    getLocations([
      me.lastLocationId ?? '',
      ...quests.map((quest) => quest.where?.locationId ?? quest.locationId ?? ''),
      ...meets.map((meet) => meet.campfireId ?? ''),
    ]),
    softly('handles', new Map<string, string>(), () => handlesFor(partnerIds)),
  ]);
  const from = locationWalkPoint(me.lastLocationId ? locations.get(me.lastLocationId) : undefined);
  const questTalkIds = new Set(quests.flatMap((quest) => (quest.talkId ? [quest.talkId] : [])));
  const items: IItineraryItem[] = [];

  for (const match of talkMatches) {
    if (questTalkIds.has(match.talk.id)) {
      continue;
    }

    items.push({
      kind: 'talk',
      title: match.talk.title,
      start: match.talk.start,
      end: match.talk.end,
      place: placeFor(match.location, match.talk),
      walkMinutes: match.walkMinutes,
      talkId: match.talk.id,
    });
  }

  for (const quest of quests) {
    const place = quest.where ?? placeFor(locations.get(quest.locationId ?? ''));

    items.push({
      kind: 'quest',
      title: quest.title,
      start: quest.when?.start ?? quest.respondedAt ?? quest.offeredAt,
      end: quest.when?.end ?? quest.expiresAt,
      place,
      walkMinutes: quest.walkMinutes ?? walkMinutes(from, locationWalkPoint(locations.get(place?.locationId ?? ''))),
      talkId: quest.talkId,
      questId: quest.id,
    });
  }

  for (const [index, meet] of meets.entries()) {
    const campfire = locations.get(meet.campfireId ?? '');
    const handle = handles.get(partnerIds[index]);

    items.push({
      kind: 'meet',
      title: handle ? `Meet @${handle}` : 'Hallway meet',
      start: meet.slot?.start ?? meet.respondedAt ?? meet.proposedAt,
      end: meet.slot?.end ?? meet.expiresAt,
      place: placeFor(campfire),
      walkMinutes: walkMinutes(from, locationWalkPoint(campfire)),
      meetId: meet.id,
    });
  }

  items.sort((left, right) => Date.parse(left.start) - Date.parse(right.start));

  const nowCutoff = nowMs + nowCardLeadMinutes * 60000;
  const now = items.find((item) => Date.parse(item.start) <= nowCutoff && (!item.end || Date.parse(item.end) >= nowMs)) ?? items[0];

  return { now, items };
}
