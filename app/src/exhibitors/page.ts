import { metricValue } from '../boards/es-aggs';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { loadAttendee } from '../quests/store';
import { questStatuses } from '../types/kubequest.constants';
import {
  IAttendee,
  IExhibitorCard,
  IExhibitorLive,
  IExhibitorMe,
  IExhibitorPage,
  IGetExhibitorInput,
  ILocation,
  IPublicPlayer,
  IQuest,
} from '../types/kubequest.interfaces';
import { QuestStatus } from '../types/kubequest.types';
import { exhibitorSettings, expoMapUrl } from './exhibitors.constants';
import { findOutpost, requireOutpost, toExhibitorCard, toExhibitorDetail } from './outposts';
import { talksByCompany } from './talks';
import {
  boothsVisitedBy,
  docCount,
  isShownPublicly,
  lastVisitBy,
  loadVisitors,
  nowRange,
  settle,
  subAggregation,
  termKeys,
  todayRange,
  visitFilter,
  visitorsNowByBooth,
} from './visits';

interface IBoothLive {
  live: IExhibitorLive;
  hereIds: string[];
}

function isQuestStatus(value: string | undefined): value is QuestStatus {
  return value !== undefined && (questStatuses as readonly string[]).includes(value);
}

async function boothLive(outpostId: string): Promise<IBoothLive> {
  const response = await getEsClient().search(
    {
      index: indexNames.XP_EVENTS,
      size: 0,
      query: { bool: { filter: visitFilter([outpostId]) } },
      aggs: {
        now: {
          filter: nowRange(),
          aggs: {
            people: { cardinality: { field: 'attendeeId' } },
            visitors: { terms: { field: 'attendeeId', size: exhibitorSettings.HERE_NOW * 4, order: { last: 'desc' } }, aggs: { last: { max: { field: 'at' } } } },
          },
        },
        today: { filter: todayRange(), aggs: { people: { cardinality: { field: 'attendeeId' } } } },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const now = subAggregation(response.aggregations, 'now');
  const today = subAggregation(response.aggregations, 'today');

  return {
    live: { visitorsNow: metricValue(now, 'people'), visitsToday: docCount(today), uniqueVisitorsToday: metricValue(today, 'people') },
    hereIds: termKeys(now, 'visitors'),
  };
}

async function playersHere(hereIds: string[], caller: IAttendee | undefined): Promise<IPublicPlayer[]> {
  if (!caller?.settings?.meetingOn) {
    return [];
  }

  const blocked = new Set(caller.blockedIds ?? []);
  const visitors = await loadVisitors(hereIds.filter((id) => id !== caller.id && !blocked.has(id)));

  return hereIds
    .flatMap((id) => {
      const visitor = visitors.get(id);

      if (!visitor || !isShownPublicly(visitor.attendee) || (visitor.attendee.blockedIds ?? []).includes(caller.id)) {
        return [];
      }

      return [visitor.player];
    })
    .slice(0, exhibitorSettings.MAX_PLAYERS_HERE);
}

async function nearbyOutposts(outpost: ILocation, attendeeId: string | undefined): Promise<IExhibitorCard[]> {
  const response = await getEsClient().search<Pick<ILocation, 'id'>>(
    {
      index: indexNames.LOCATIONS,
      size: exhibitorSettings.NEARBY,
      _source: ['id'],
      query: { bool: { filter: [{ term: { kind: 'outpost' } }], must_not: [{ ids: { values: [outpost.id] } }] } },
      sort: [{ _geo_distance: { geo: { lat: outpost.geo.lat, lon: outpost.geo.lon }, order: 'asc', unit: 'm' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const ids = response.hits.hits.flatMap((hit) => (hit._id ? [hit._id] : []));
  const [locations, visitorsNow, visited] = await Promise.all([
    Promise.all(ids.map((id) => findOutpost(id))),
    settle('exhibitor.nearby.visitorsNow', visitorsNowByBooth(ids), new Map<string, number>()),
    attendeeId ? settle('exhibitor.nearby.visited', boothsVisitedBy(attendeeId), new Set<string>()) : Promise.resolve(undefined),
  ]);

  return locations.flatMap((location) =>
    location ? [toExhibitorCard(location, visitorsNow.get(location.id) ?? 0, visited ? visited.has(location.id) : undefined)] : [],
  );
}

async function boothQuestFor(attendeeId: string, outpostId: string): Promise<IQuest | undefined> {
  const response = await getEsClient().search<IQuest>(
    {
      index: indexNames.QUESTS,
      size: 1,
      _source: ['id', 'status'],
      query: { bool: { filter: [{ term: { attendeeId } }, { term: { type: 'outpost' } }, { term: { locationId: outpostId } }] } },
      sort: [{ offeredAt: { order: 'desc' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const hit = response.hits.hits[0];

  return hit?._source ? { ...hit._source, id: hit._id ?? hit._source.id } : undefined;
}

async function meAt(attendeeId: string, outpostId: string): Promise<IExhibitorMe> {
  const [lastVisitAt, quest] = await Promise.all([
    lastVisitBy(attendeeId, outpostId),
    settle('exhibitor.me.quest', boothQuestFor(attendeeId, outpostId), undefined),
  ]);

  return {
    visited: lastVisitAt !== undefined,
    ...(lastVisitAt ? { lastVisitAt } : {}),
    ...(quest ? { questId: quest.id } : {}),
    ...(quest && isQuestStatus(quest.status) ? { questStatus: quest.status } : {}),
  };
}

export async function getExhibitorPage(input: IGetExhibitorInput): Promise<IExhibitorPage> {
  const [outpost, caller] = await Promise.all([
    requireOutpost(input.outpostId),
    input.attendeeId ? loadAttendee(input.attendeeId) : Promise.resolve(undefined),
  ]);
  const emptyLive: IBoothLive = { live: { visitorsNow: 0, visitsToday: 0, uniqueVisitorsToday: 0 }, hereIds: [] };

  const [booth, talks, nearby, me] = await Promise.all([
    settle('exhibitor.live', boothLive(outpost.id), emptyLive),
    settle('exhibitor.talks', talksByCompany(outpost.name), []),
    settle('exhibitor.nearby', nearbyOutposts(outpost, input.attendeeId), []),
    input.attendeeId ? meAt(input.attendeeId, outpost.id) : Promise.resolve(undefined),
  ]);

  const here = await settle('exhibitor.playersHere', playersHere(booth.hereIds, caller), []);

  return {
    exhibitor: toExhibitorDetail(outpost, booth.live.visitorsNow, me?.visited),
    live: booth.live,
    talks,
    playersHere: here,
    nearby,
    ...(me ? { me } : {}),
    expoMapUrl,
    generatedAt: new Date().toISOString(),
  };
}
