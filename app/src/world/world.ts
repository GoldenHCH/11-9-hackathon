import { trace } from '@opentelemetry/api';
import type { estypes } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { gameRules } from '../types/kubequest.constants';
import { ILocation, ITalk, IWorld, IWorldBuilding, IWorldInput, IWorldRoom } from '../types/kubequest.interfaces';
import { worldNow } from './clock';
import { compareBuildings, compareLevels } from './locations';
import { walkMinutes } from './walk';

const MAX_LOCATIONS = 500;
const MAX_TALKS = 2000;
const TALK_LOOKAHEAD_HOURS = 24;
const kindOrder = ['boss-room', 'room', 'theater', 'outpost', 'campfire'];

const talkSourceFields = [
  'id',
  'title',
  'abstract',
  'sessionType',
  'track',
  'material',
  'speakers',
  'speakerDetails',
  'start',
  'end',
  'locationId',
  'building',
  'level',
  'room',
  'geo',
  'isBoss',
  'hasTranscript',
  'url',
];

const locationSourceFields = [
  'id',
  'name',
  'kind',
  'building',
  'level',
  'room',
  'zone',
  'geo',
  'description',
  'boothNumber',
  'sponsorTier',
  'askAbout',
  'topics',
  'hasScreen',
];

function sources<T>(response: estypes.SearchResponse<T>): T[] {
  return response.hits.hits.flatMap((hit) => (hit._source ? [hit._source] : []));
}

export async function listLocations(): Promise<ILocation[]> {
  const response = await getEsClient().search<ILocation>(
    {
      index: indexNames.LOCATIONS,
      size: MAX_LOCATIONS,
      _source: locationSourceFields,
      query: { match_all: {} },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return sources(response);
}

async function upcomingTalks(now: Date): Promise<ITalk[]> {
  const until = new Date(now.getTime() + TALK_LOOKAHEAD_HOURS * 3_600_000);
  const response = await getEsClient().search<ITalk>(
    {
      index: indexNames.TALKS,
      size: MAX_TALKS,
      _source: talkSourceFields,
      query: {
        bool: {
          filter: [{ range: { end: { gt: now.toISOString() } } }, { range: { start: { lte: until.toISOString() } } }],
        },
      },
      sort: [{ start: { order: 'asc' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return sources(response);
}

async function recentCheckInCounts(now: Date): Promise<Map<string, number>> {
  const since = new Date(now.getTime() - gameRules.BUSYNESS_WINDOW_MINUTES * 60_000);
  const response = await getEsClient().search(
    {
      index: indexNames.XP_EVENTS,
      size: 0,
      query: {
        bool: {
          filter: [
            { terms: { type: ['check_in', 'outpost'] } },
            { range: { at: { gte: since.toISOString(), lte: now.toISOString() } } },
          ],
        },
      },
      aggs: { byLocation: { terms: { field: 'locationId', size: MAX_LOCATIONS } } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const counts = new Map<string, number>();
  const aggregate = response.aggregations?.byLocation as estypes.AggregationsStringTermsAggregate | undefined;
  const buckets = aggregate && Array.isArray(aggregate.buckets) ? aggregate.buckets : [];

  for (const bucket of buckets) {
    counts.set(String(bucket.key), bucket.doc_count);
  }

  return counts;
}

async function lastLocationIdFor(attendeeId: string | undefined): Promise<string | undefined> {
  if (!attendeeId) {
    return undefined;
  }

  const response = await getEsClient().get<{ lastLocationId?: string }>(
    { index: indexNames.ATTENDEES, id: attendeeId, _source_includes: ['lastLocationId'] },
    { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] },
  );

  return response.found ? response._source?.lastLocationId : undefined;
}

function nowAndNext(talks: ITalk[], now: Date): { now?: ITalk; next?: ITalk } {
  const nowMs = now.getTime();
  const current = talks.find((talk) => Date.parse(talk.start) <= nowMs && Date.parse(talk.end) > nowMs);
  const next = talks.find((talk) => Date.parse(talk.start) > nowMs);

  return { now: current, next };
}

function compareRooms(left: IWorldRoom, right: IWorldRoom): number {
  return (
    kindOrder.indexOf(left.location.kind) - kindOrder.indexOf(right.location.kind) ||
    left.location.name.localeCompare(right.location.name)
  );
}

export function assembleWorld(
  locations: ILocation[],
  talks: ITalk[],
  checkIns: Map<string, number>,
  origin: ILocation | undefined,
  now: Date,
): IWorld {
  const talksByLocation = new Map<string, ITalk[]>();

  for (const talk of talks) {
    const list = talksByLocation.get(talk.locationId) ?? [];
    list.push(talk);
    talksByLocation.set(talk.locationId, list);
  }

  const buildings = new Map<string, Map<string, IWorldRoom[]>>();

  for (const location of locations) {
    const levels = buildings.get(location.building) ?? new Map<string, IWorldRoom[]>();
    const rooms = levels.get(location.level) ?? [];
    const sessions = nowAndNext(talksByLocation.get(location.id) ?? [], now);

    rooms.push({
      location,
      ...sessions,
      busyness: checkIns.get(location.id) ?? 0,
      walkMinutes: walkMinutes(origin, location),
    });
    levels.set(location.level, rooms);
    buildings.set(location.building, levels);
  }

  const worldBuildings: IWorldBuilding[] = [...buildings.entries()]
    .sort(([left], [right]) => compareBuildings(left, right))
    .map(([name, levels]) => ({
      name,
      levels: [...levels.entries()]
        .sort(([left], [right]) => compareLevels(left, right))
        .map(([levelName, rooms]) => ({ name: levelName, rooms: rooms.sort(compareRooms) })),
    }));

  return { buildings: worldBuildings, generatedAt: now.toISOString() };
}

export async function buildWorld(input: IWorldInput): Promise<IWorld> {
  const now = worldNow();
  const [locations, talks, checkIns, lastLocationId] = await Promise.all([
    listLocations(),
    upcomingTalks(now),
    recentCheckInCounts(now),
    lastLocationIdFor(input.attendeeId),
  ]);
  const origin = lastLocationId ? locations.find((location) => location.id === lastLocationId) : undefined;
  const world = assembleWorld(locations, talks, checkIns, origin, now);
  const span = trace.getActiveSpan();

  span?.setAttributes({
    'kubequest.world.locations': locations.length,
    'kubequest.world.talks': talks.length,
    'kubequest.world.busy_rooms': checkIns.size,
    'kubequest.world.has_origin': origin !== undefined,
  });

  return world;
}
