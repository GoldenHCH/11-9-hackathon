import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import type { IOfferContext } from '../quests/offers';
import { placeOf, questId, walkPointOf } from '../quests/store';
import { endOfConferenceDay } from '../quests/time';
import { gameRules, xpRewards } from '../types/kubequest.constants';
import { ILocation, IQuest } from '../types/kubequest.interfaces';
import { walkMinutes } from '../world/walk';
import { visiblePhotoCounts } from './booth-photos';

const BOOTHS_TO_CHECK = 8;

function photoQuest(context: IOfferContext, location: ILocation, photoCount: number): IQuest {
  const booth = location.boothNumber ? ` at booth ${location.boothNumber}` : '';

  return {
    id: questId(context.attendee.id, 'photo', location.id),
    attendeeId: context.attendee.id,
    type: 'photo',
    status: 'offered',
    source: 'board',
    offeredAt: context.now.toISOString(),
    title: `Photograph the ${location.name} booth`,
    reason:
      photoCount === 0
        ? `Be the first to show us the ${location.name} booth.`
        : `Only ${photoCount} ${photoCount === 1 ? 'photo' : 'photos'} of ${location.name} so far. Show everyone what it looks like.`,
    nextStep: `Find ${location.name}${booth}, scan the QR on its table, then tap Take photo. Photograph the booth, not people.`,
    reward: { xp: xpRewards.PHOTO, label: `${xpRewards.PHOTO} XP and your photo on the map` },
    where: placeOf(location),
    walkMinutes: walkMinutes(walkPointOf(context.here), walkPointOf(location)),
    locationId: location.id,
    expiresAt: endOfConferenceDay(context.now).toISOString(),
  };
}

export async function photoQuestCandidates(context: IOfferContext): Promise<IQuest[]> {
  const topics = context.attendee.profile.topics;

  if (context.attendee.settings.noWalking || topics.length === 0) {
    return [];
  }

  const response = await getEsClient().search<ILocation>(
    {
      index: indexNames.LOCATIONS,
      size: BOOTHS_TO_CHECK,
      query: { bool: { filter: [{ term: { kind: 'outpost' } }, { terms: { topics } }] } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );
  const booths = response.hits.hits.flatMap((hit) => (hit._source ? [{ ...hit._source, id: hit._source.id ?? hit._id ?? '' }] : []));
  const counts = await visiblePhotoCounts(booths.map((booth) => booth.id));
  const pick = booths
    .map((booth) => ({ booth, count: counts.get(booth.id) ?? 0 }))
    .filter((entry) => entry.count < gameRules.PHOTO_QUEST_BELOW)
    .sort((left, right) => left.count - right.count)[0];

  return pick ? [photoQuest(context, pick.booth, pick.count)] : [];
}
