import type { estypes } from '@elastic/elasticsearch';
import { trace } from '@opentelemetry/api';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { topicRules } from '../profile/profile.constants';
import { loadAttendee } from '../quests/store';
import { tracks } from '../types/kubequest.constants';
import { IExhibitorDirectory, IFacetCount, IListExhibitorsInput, ILocation } from '../types/kubequest.interfaces';
import { Track } from '../types/kubequest.types';
import { exhibitorSettings } from './exhibitors.constants';
import { IDirectoryFilters } from './exhibitors.interfaces';
import { compareBooths, exhibitorTypeOf, loadOutposts, tierOf, tierRank, toExhibitorCard, trackTopics } from './outposts';
import { boothsVisitedBy, safeErrorFields, settle, visitorsNowByBooth } from './visits';

type QueryContainer = estypes.QueryDslQueryContainer;
type FacetName = keyof IDirectoryFilters;

const lexicalFields = ['name^3', 'askAbout^2', 'categories^2', 'description', 'zone', 'sponsorTier'];

function normalized(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function isTrack(value: string): value is Track {
  return (tracks as readonly string[]).includes(value);
}

export function tracksForTopics(topics: string[]): Set<Track> {
  const found = new Set<Track>();

  for (const topic of topics) {
    const text = normalized(topic);

    if (isTrack(text)) {
      found.add(text);
      continue;
    }

    const rule = topicRules.find(
      (candidate) => normalized(candidate.topic) === text || candidate.keywords.some((keyword) => ` ${text}`.includes(` ${normalized(keyword)}`)),
    );

    if (rule) {
      found.add(rule.track);
    }
  }

  return found;
}

function blankToUndefined(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function filtersOf(input: IListExhibitorsInput): IDirectoryFilters {
  return {
    type: blankToUndefined(input.type),
    tier: blankToUndefined(input.tier),
    zone: blankToUndefined(input.zone),
    topic: blankToUndefined(input.topic),
  };
}

function matchesFilter(location: ILocation, name: FacetName, value: string | undefined): boolean {
  if (value === undefined) {
    return true;
  }

  switch (name) {
    case 'type':
      return exhibitorTypeOf(location) === value;
    case 'tier':
      return tierOf(location).toLowerCase() === value.toLowerCase();
    case 'zone':
      return (location.zone ?? '').toLowerCase() === value.toLowerCase();
    case 'topic':
      return trackTopics(location).some((topic) => topic === value);
  }
}

function matchesAll(location: ILocation, filters: IDirectoryFilters, except?: FacetName): boolean {
  return (Object.keys(filters) as FacetName[]).every((name) => name === except || matchesFilter(location, name, filters[name]));
}

function facetValues(location: ILocation, name: FacetName): string[] {
  switch (name) {
    case 'type':
      return [exhibitorTypeOf(location)];
    case 'tier':
      return [tierOf(location)];
    case 'zone':
      return location.zone ? [location.zone] : [];
    case 'topic':
      return trackTopics(location);
  }
}

function countFacet(pool: ILocation[], filters: IDirectoryFilters, name: FacetName): IFacetCount[] {
  const counts = new Map<string, number>();

  for (const location of pool) {
    if (!matchesAll(location, filters, name)) {
      continue;
    }

    for (const value of facetValues(location, name)) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  const facets = [...counts.entries()].map(([value, count]) => ({ value, count }));

  if (name === 'tier') {
    return facets.sort((left, right) => tierRank(left.value) - tierRank(right.value) || left.value.localeCompare(right.value));
  }

  return facets.sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

async function searchIds(query: string): Promise<string[]> {
  const span = trace.getActiveSpan();
  const client = getEsClient();
  const filter: QueryContainer[] = [{ term: { kind: 'outpost' } }];
  const lexical: QueryContainer = { multi_match: { query, fields: lexicalFields, type: 'best_fields', fuzziness: 'AUTO', lenient: true } };
  const common = {
    index: indexNames.LOCATIONS,
    size: exhibitorSettings.QUERY_WINDOW,
    _source: false,
    timeout: exhibitorSettings.SERVER_TIMEOUT,
  } as const;

  try {
    const response = await client.search(
      {
        ...common,
        retriever: {
          rrf: {
            retrievers: [
              { standard: { query: { bool: { must: [lexical], filter } } } },
              { standard: { query: { bool: { must: [{ match: { searchText: { query } } }], filter } } } },
            ],
            rank_window_size: exhibitorSettings.QUERY_WINDOW,
            rank_constant: exhibitorSettings.RANK_CONSTANT,
          },
        },
      },
      esOptions(esTimeouts.SEARCH_MS),
    );
    span?.setAttribute('kubequest.search.mode', 'hybrid');

    return response.hits.hits.flatMap((hit) => (hit._id ? [hit._id] : []));
  } catch (error) {
    logger.warn(safeErrorFields(error), 'hybrid exhibitor search failed, falling back to lexical');
    span?.setAttribute('kubequest.search.mode', 'lexical');

    const response = await client.search({ ...common, query: { bool: { must: [lexical], filter } } }, esOptions(esTimeouts.SEARCH_MS));

    return response.hits.hits.flatMap((hit) => (hit._id ? [hit._id] : []));
  }
}

function browseOrder(pool: ILocation[], preferred: Set<Track>): ILocation[] {
  if (preferred.size === 0) {
    return [...pool].sort(compareBooths);
  }

  const overlap = (location: ILocation): number => trackTopics(location).filter((topic) => preferred.has(topic)).length;

  return [...pool].sort((left, right) => overlap(right) - overlap(left) || compareBooths(left, right));
}

export async function listExhibitors(input: IListExhibitorsInput): Promise<IExhibitorDirectory> {
  const span = trace.getActiveSpan();
  const filters = filtersOf(input);
  const query = input.query?.trim() ?? '';
  const limit = input.limit ?? exhibitorSettings.DEFAULT_LIMIT;
  const offset = input.offset ?? 0;
  const [attendee, all] = await Promise.all([input.attendeeId ? loadAttendee(input.attendeeId) : Promise.resolve(undefined), loadOutposts()]);
  let pool: ILocation[];

  if (query !== '') {
    const byId = new Map(all.map((location) => [location.id, location]));
    const ids = await searchIds(query);
    pool = ids.flatMap((id) => {
      const location = byId.get(id);

      return location ? [location] : [];
    });
  } else {
    pool = browseOrder(all, tracksForTopics(attendee?.profile?.topics ?? []));
  }

  const matching = pool.filter((location) => matchesAll(location, filters));
  const page = matching.slice(offset, offset + limit);
  const pageIds = page.map((location) => location.id);
  const [visitorsNow, visited] = await Promise.all([
    settle('exhibitors.visitorsNow', visitorsNowByBooth(pageIds), new Map<string, number>()),
    input.attendeeId ? settle('exhibitors.visitedByMe', boothsVisitedBy(input.attendeeId), new Set<string>()) : Promise.resolve(undefined),
  ]);

  span?.setAttributes({
    'kubequest.exhibitors.total': matching.length,
    'kubequest.exhibitors.returned': page.length,
    'kubequest.exhibitors.query': query !== '',
  });

  return {
    exhibitors: page.map((location) => toExhibitorCard(location, visitorsNow.get(location.id) ?? 0, visited ? visited.has(location.id) : undefined)),
    total: matching.length,
    facets: {
      types: countFacet(pool, filters, 'type'),
      tiers: countFacet(pool, filters, 'tier'),
      zones: countFacet(pool, filters, 'zone'),
      topics: countFacet(pool, filters, 'topic'),
    },
    generatedAt: new Date().toISOString(),
  };
}
