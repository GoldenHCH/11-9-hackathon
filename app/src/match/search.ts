import { trace } from '@opentelemetry/api';
import type { estypes } from '@elastic/elasticsearch';
import { appConfig } from '../config';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { IWalkPoint } from '../types/internal.interfaces';
import {
  IAttendee,
  IGeoPoint,
  ILocation,
  IMatchPlayer,
  ISearchFilters,
  ISearchInput,
  ISearchResponse,
  ISearchResult,
  ITalk,
} from '../types/kubequest.interfaces';
import { SearchResultKind } from '../types/kubequest.types';
import { searchResultKinds } from '../types/kubequest.constants';
import { walkMinutes } from '../world/walk';
import { levelDefinitionForXp } from '../xp/levels';

type QueryContainer = estypes.QueryDslQueryContainer;

interface IRequester {
  id?: string;
  geo?: IGeoPoint;
  walkPoint?: IWalkPoint;
  blockedIds: string[];
}

const searchSettings = {
  DEFAULT_LIMIT: 20,
  NOW_WINDOW_MINUTES: 30,
  PLAYER_SEEN_MINUTES: 30,
  NEAR_ME_DISTANCE: '400m',
  RANK_WINDOW: 60,
  RANK_CONSTANT: 20,
  SERVER_TIMEOUT: '6s',
} as const;

const lexicalFields = [
  'title^3',
  'name^3',
  'handle^2',
  'speakers^2',
  'headline^2',
  'abstract',
  'workingOn',
  'description',
  'askAbout',
  'topics',
  'profile.topics',
];

const semanticFields = ['searchText', 'profileText'];

const privateSourceFields = [
  'realName',
  'displayName',
  'email',
  'photoUrl',
  'spotMe',
  'githubLogin',
  'avatarUrl',
  'blockedIds',
  'settings',
  'profileText',
  'searchText',
  'transcript',
  'quiz',
  'bossQuiz',
  'lastLocationId',
  'lastSeenAt',
  'createdAt',
  '_inference_fields',
];

const roomLocationKinds = ['room', 'theater', 'boss-room'];

function indexFilter(index: string): QueryContainer {
  return { term: { _index: index } };
}

function wantedKinds(filters: ISearchFilters): Set<SearchResultKind> {
  const kinds = filters.kinds && filters.kinds.length > 0 ? filters.kinds : [...searchResultKinds];

  return new Set(kinds);
}

function nearFilter(field: string, requester: IRequester): QueryContainer[] {
  if (!requester.geo) {
    return [];
  }

  return [{ geo_distance: { distance: searchSettings.NEAR_ME_DISTANCE, [field]: { lat: requester.geo.lat, lon: requester.geo.lon } } }];
}

function sessionClause(filters: ISearchFilters, requester: IRequester, now: Date): QueryContainer {
  const filter: QueryContainer[] = [indexFilter(indexNames.TALKS)];

  if (filters.now) {
    const horizon = new Date(now.getTime() + searchSettings.NOW_WINDOW_MINUTES * 60_000);
    filter.push({ range: { start: { lte: horizon.toISOString() } } }, { range: { end: { gte: now.toISOString() } } });
  }

  if (filters.track) {
    filter.push({ term: { track: filters.track } });
  }

  if (filters.building) {
    filter.push({ term: { building: filters.building } });
  }

  if (filters.nearMe) {
    filter.push(...nearFilter('geo', requester));
  }

  return { bool: { filter } };
}

function playerClause(filters: ISearchFilters, requester: IRequester, now: Date): QueryContainer {
  const filter: QueryContainer[] = [
    indexFilter(indexNames.ATTENDEES),
    { term: { visible: true } },
    { term: { 'settings.meetingOn': true } },
  ];
  const mustNot: QueryContainer[] = [];

  if (requester.id) {
    mustNot.push({ ids: { values: [requester.id] } }, { term: { blockedIds: requester.id } });
  }

  if (requester.blockedIds.length > 0) {
    mustNot.push({ ids: { values: requester.blockedIds } });
  }

  if (filters.now) {
    const since = new Date(now.getTime() - searchSettings.PLAYER_SEEN_MINUTES * 60_000);
    filter.push({ range: { lastSeenAt: { gte: since.toISOString() } } });
  }

  if (filters.track) {
    filter.push({ term: { 'profile.topics': filters.track } });
  }

  if (filters.nearMe) {
    filter.push(...nearFilter('lastLocation', requester));
  }

  return { bool: { filter, must_not: mustNot } };
}

function locationClause(filters: ISearchFilters, requester: IRequester, kinds: Set<SearchResultKind>): QueryContainer {
  const locationKinds: string[] = [];

  if (kinds.has('outpost')) {
    locationKinds.push('outpost');
  }

  if (kinds.has('room')) {
    locationKinds.push(...roomLocationKinds);
  }

  if (kinds.has('campfire')) {
    locationKinds.push('campfire');
  }

  const filter: QueryContainer[] = [indexFilter(indexNames.LOCATIONS), { terms: { kind: locationKinds } }];

  if (filters.track) {
    filter.push({ term: { topics: filters.track } });
  }

  if (filters.building) {
    filter.push({ term: { building: filters.building } });
  }

  if (filters.nearMe) {
    filter.push(...nearFilter('geo', requester));
  }

  return { bool: { filter } };
}

function scopeFilter(filters: ISearchFilters, requester: IRequester, now: Date): QueryContainer {
  const kinds = wantedKinds(filters);
  const should: QueryContainer[] = [];

  if (kinds.has('session')) {
    should.push(sessionClause(filters, requester, now));
  }

  if (kinds.has('player') && !filters.building) {
    should.push(playerClause(filters, requester, now));
  }

  if (!filters.now && (kinds.has('outpost') || kinds.has('room') || kinds.has('campfire'))) {
    should.push(locationClause(filters, requester, kinds));
  }

  if (should.length === 0) {
    return { bool: { must_not: [{ match_all: {} }] } };
  }

  return { bool: { should, minimum_should_match: 1 } };
}

function lexicalQuery(query: string): QueryContainer {
  return {
    multi_match: {
      query,
      fields: lexicalFields,
      type: 'best_fields',
      fuzziness: 'AUTO',
      lenient: true,
    },
  };
}

function semanticQuery(query: string): QueryContainer {
  return {
    bool: {
      should: semanticFields.map((field) => ({ match: { [field]: { query } } })),
      minimum_should_match: 1,
    },
  };
}

function hybridRetriever(query: string, scope: QueryContainer, size: number): estypes.RetrieverContainer {
  return {
    rrf: {
      retrievers: [
        { standard: { query: { bool: { must: [lexicalQuery(query)], filter: [scope] } } } },
        { standard: { query: { bool: { must: [semanticQuery(query)], filter: [scope] } } } },
      ],
      rank_window_size: Math.max(searchSettings.RANK_WINDOW, size),
      rank_constant: searchSettings.RANK_CONSTANT,
    },
  };
}

function haversineMeters(a: IGeoPoint, b: IGeoPoint): number {
  const radius = 6_371_000;
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;

  return Math.round(2 * radius * Math.asin(Math.sqrt(h)));
}

function locationResultKind(location: ILocation): SearchResultKind {
  if (location.kind === 'outpost' || location.kind === 'campfire') {
    return location.kind;
  }

  return 'room';
}

function formatClock(iso: string): string {
  const date = new Date(iso);

  return Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: appConfig.conferenceTimeZone }).format(date);
}

function toMatchPlayer(source: Partial<IAttendee>): IMatchPlayer {
  const xp = source.xp ?? 0;
  const definition = levelDefinitionForXp(xp);

  return {
    id: source.id ?? '',
    handle: source.handle ?? '',
    faceSeed: source.faceSeed ?? source.id ?? '',
    level: source.level ?? definition.level,
    levelName: definition.name,
    xp,
    banners: source.banners ?? [],
    isSpeaker: source.isSpeaker,
    topics: source.profile?.topics ?? [],
    workingOn: source.workingOn ?? '',
    firstTimer: source.profile?.firstTimer ?? false,
  };
}

function distanceFields(requester: IRequester, target: IGeoPoint | undefined, point: IWalkPoint | undefined): Partial<ISearchResult> {
  const fields: Partial<ISearchResult> = {};

  if (requester.geo && target) {
    fields.distanceMeters = haversineMeters(requester.geo, target);
  }

  const walk = walkMinutes(requester.walkPoint, point);

  if (walk !== undefined) {
    fields.walkMinutes = walk;
  }

  return fields;
}

function toResult(hit: estypes.SearchHit<Record<string, unknown>>, requester: IRequester, now: Date): ISearchResult | undefined {
  const source = hit._source;
  const id = hit._id;

  if (!source || !id) {
    return undefined;
  }

  const score = hit._score ?? 0;

  if (hit._index.startsWith(indexNames.TALKS)) {
    const talk = { ...(source as unknown as ITalk), id };
    const startsInMinutes = Math.round((new Date(talk.start).getTime() - now.getTime()) / 60_000);
    const speakers = (talk.speakers ?? []).join(', ');
    const subtitle = [speakers, talk.room, formatClock(talk.start)].filter((part) => part !== '' && part !== undefined).join(' · ');
    const point: IWalkPoint = { id: talk.locationId, building: talk.building, level: talk.level };

    return { kind: 'session', id, title: talk.title, subtitle, score, talk, startsInMinutes, ...distanceFields(requester, talk.geo, point) };
  }

  if (hit._index.startsWith(indexNames.ATTENDEES)) {
    const attendee = source as Partial<IAttendee>;
    const player = toMatchPlayer({ ...attendee, id });
    const subtitle = attendee.headline ?? attendee.workingOn ?? player.levelName;

    return { kind: 'player', id, title: player.handle, subtitle, score, player, ...distanceFields(requester, attendee.lastLocation, undefined) };
  }

  if (hit._index.startsWith(indexNames.LOCATIONS)) {
    const location = { ...(source as unknown as ILocation), id };
    const subtitle = location.description ?? [location.building, location.level, location.room].filter(Boolean).join(' · ');
    const point: IWalkPoint = { id: location.id, building: location.building, level: location.level };

    return { kind: locationResultKind(location), id, title: location.name, subtitle, score, location, ...distanceFields(requester, location.geo, point) };
  }

  return undefined;
}

async function loadRequester(input: ISearchInput): Promise<IRequester> {
  const requester: IRequester = { id: input.attendeeId, geo: input.geo, blockedIds: [] };

  if (!input.attendeeId) {
    return requester;
  }

  const client = getEsClient();

  try {
    const response = await client.get<Partial<IAttendee>>(
      { index: indexNames.ATTENDEES, id: input.attendeeId, _source_includes: ['lastLocation', 'lastLocationId', 'blockedIds'] },
      esOptions(esTimeouts.DEFAULT_MS),
    );
    const attendee = response._source;

    requester.blockedIds = attendee?.blockedIds ?? [];
    requester.geo ??= attendee?.lastLocation;

    if (attendee?.lastLocationId) {
      const location = await client.get<ILocation>(
        { index: indexNames.LOCATIONS, id: attendee.lastLocationId, _source_includes: ['building', 'level', 'geo'] },
        esOptions(esTimeouts.DEFAULT_MS),
      );

      if (location._source) {
        requester.walkPoint = { id: attendee.lastLocationId, building: location._source.building, level: location._source.level };
        requester.geo ??= location._source.geo;
      }
    }
  } catch (error) {
    logger.warn({ err: error, attendeeId: input.attendeeId }, 'search requester lookup failed');
  }

  return requester;
}

async function runSearch(
  body: Omit<estypes.SearchRequest, 'index'>,
): Promise<estypes.SearchResponse<Record<string, unknown>>> {
  return getEsClient().search<Record<string, unknown>>(
    {
      index: [indexNames.TALKS, indexNames.ATTENDEES, indexNames.LOCATIONS],
      ignore_unavailable: true,
      allow_no_indices: true,
      timeout: searchSettings.SERVER_TIMEOUT,
      _source: { excludes: privateSourceFields },
      ...body,
    },
    esOptions(esTimeouts.SEARCH_MS),
  );
}

export async function hybridSearch(input: ISearchInput): Promise<ISearchResponse> {
  const span = trace.getActiveSpan();
  const now = new Date();
  const filters = input.filters ?? {};
  const size = input.limit ?? searchSettings.DEFAULT_LIMIT;
  const query = input.query.trim();
  const requester = await loadRequester(input);
  const scope = scopeFilter(filters, requester, now);
  let mode: 'hybrid' | 'lexical' | 'browse' = query === '' ? 'browse' : 'hybrid';
  let response: estypes.SearchResponse<Record<string, unknown>>;

  if (mode === 'browse') {
    response = await runSearch({ size, query: { bool: { filter: [scope] } }, sort: [{ start: { order: 'asc', unmapped_type: 'date' } }] });
  } else {
    try {
      response = await runSearch({ size, retriever: hybridRetriever(query, scope, size) });
    } catch (error) {
      logger.warn({ err: error }, 'hybrid search failed, falling back to lexical');
      mode = 'lexical';
      response = await runSearch({ size, query: { bool: { must: [lexicalQuery(query)], filter: [scope] } } });
    }
  }

  const results = response.hits.hits
    .map((hit) => toResult(hit, requester, now))
    .filter((result): result is ISearchResult => result !== undefined);

  span?.setAttributes({
    'kubequest.search.mode': mode,
    'kubequest.search.results': results.length,
    'kubequest.search.took_ms': response.took,
    'kubequest.search.filters': Object.keys(filters).join(','),
  });

  return { query: input.query, results };
}
