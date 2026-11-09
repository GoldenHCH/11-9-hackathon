import type { estypes } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { rerankRetriever, searchWithFallbacks } from '../es/rerank';
import { IAttendee, ITalk, ITalkMatch } from '../types/kubequest.interfaces';
import {
  checkedInTalkIds,
  getAttendee,
  getLocations,
  locationWalkPoint,
  minutesUntil,
  profileQueryText,
  talkSourceExcludes,
  topicsInText,
  walkToTalk,
} from './match-data';

export interface IRecommendTalksOptions {
  limit?: number;
  withinMinutes?: number;
}

const defaultLimit = 5;
const defaultWindowMinutes = 240;

function talkFilters(nowMs: number, withinMinutes: number | undefined, excludeIds: string[]): estypes.QueryDslQueryContainer {
  const start: estypes.QueryDslDateRangeQuery = { gt: new Date(nowMs).toISOString() };

  if (withinMinutes !== undefined) {
    start.lte = new Date(nowMs + withinMinutes * 60000).toISOString();
  }

  return {
    bool: {
      filter: [{ range: { start } }],
      must_not: excludeIds.length > 0 ? [{ ids: { values: excludeIds } }] : [],
    },
  };
}

function keywordQuery(attendee: IAttendee, queryText: string, filter: estypes.QueryDslQueryContainer): estypes.QueryDslQueryContainer {
  const topics = attendee.profile?.topics ?? [];
  const should: estypes.QueryDslQueryContainer[] = [
    { multi_match: { query: queryText, fields: ['title^2', 'abstract', 'speakers'] } },
  ];

  if (topics.length > 0) {
    should.push({ multi_match: { query: topics.join(' '), fields: ['title^3', 'abstract^2', 'track'], boost: 2 } });
    should.push({ terms: { track: topics.map((topic) => topic.toLowerCase()), boost: 2 } });
  }

  return { bool: { filter: [filter], should, minimum_should_match: 1 } };
}

async function hybridTalks(
  attendee: IAttendee,
  filter: estypes.QueryDslQueryContainer,
  size: number,
): Promise<estypes.SearchHit<ITalk>[]> {
  const client = getEsClient();
  const queryText = profileQueryText(attendee);

  if (queryText === '') {
    const response = await client.search<ITalk>(
      { index: indexNames.TALKS, size, query: filter, sort: [{ start: 'asc' }], _source_excludes: talkSourceExcludes },
      esOptions(esTimeouts.SEARCH_MS),
    );

    return response.hits.hits;
  }

  const hybrid: estypes.RetrieverContainer = {
    rrf: {
      retrievers: [
        { standard: { query: { bool: { filter: [filter], must: [{ semantic: { field: 'searchText', query: queryText } }] } } } },
        { standard: { query: keywordQuery(attendee, queryText, filter) } },
      ],
      rank_window_size: Math.max(50, size),
      rank_constant: 20,
    },
  };
  const byRetriever = async (retriever: estypes.RetrieverContainer): Promise<estypes.SearchHit<ITalk>[]> => {
    const response = await client.search<ITalk>(
      { index: indexNames.TALKS, size, _source_excludes: talkSourceExcludes, retriever },
      esOptions(esTimeouts.SEARCH_MS),
    );

    return response.hits.hits;
  };
  const keywordOnly = async (): Promise<estypes.SearchHit<ITalk>[]> => {
    const response = await client.search<ITalk>(
      {
        index: indexNames.TALKS,
        size,
        _source_excludes: talkSourceExcludes,
        query: { bool: { filter: [filter], should: [keywordQuery(attendee, queryText, filter), { match_all: {} }] } },
      },
      esOptions(esTimeouts.SEARCH_MS),
    );

    return response.hits.hits;
  };
  const { result } = await searchWithFallbacks('talks', [
    { mode: 'reranked', run: () => byRetriever(rerankRetriever(hybrid, 'searchText', queryText, size)) },
    { mode: 'hybrid', run: () => byRetriever(hybrid) },
    { mode: 'lexical', run: keywordOnly },
  ]);

  return result;
}

function reasonFor(attendee: IAttendee, talk: ITalk, startsInMinutes: number): string {
  const matched = topicsInText(attendee.profile?.topics ?? [], `${talk.title} ${talk.abstract} ${talk.track}`);
  const when = startsInMinutes <= 1 ? 'starting now' : `in ${startsInMinutes} min`;

  if (matched.length > 0) {
    return `Covers ${matched.slice(0, 2).join(' and ')}, ${when}`;
  }

  return `Close to what you're working on, ${when}`;
}

export async function recommendTalksFor(attendeeId: string, opts: IRecommendTalksOptions = {}): Promise<ITalkMatch[]> {
  const nowMs = Date.now();
  const limit = opts.limit ?? defaultLimit;
  const attendee = await getAttendee(attendeeId);
  const attended = await checkedInTalkIds(attendeeId);
  const excluded = [...attended];
  const window = opts.withinMinutes ?? defaultWindowMinutes;

  let hits = await hybridTalks(attendee, talkFilters(nowMs, window, excluded), limit);

  if (hits.length === 0 && opts.withinMinutes === undefined) {
    hits = await hybridTalks(attendee, talkFilters(nowMs, undefined, excluded), limit);
  }

  const talks = hits.flatMap((hit) => (hit._source ? [{ talk: { ...hit._source, id: hit._id ?? hit._source.id }, score: hit._score ?? 0 }] : []));
  const locations = await getLocations([...talks.map((entry) => entry.talk.locationId), attendee.lastLocationId ?? '']);
  const from = locationWalkPoint(attendee.lastLocationId ? locations.get(attendee.lastLocationId) : undefined);

  return talks.map(({ talk, score }) => {
    const startsInMinutes = minutesUntil(talk.start, nowMs);

    return {
      talk,
      location: locations.get(talk.locationId),
      score,
      reason: reasonFor(attendee, talk, startsInMinutes),
      startsInMinutes,
      walkMinutes: walkToTalk(from, talk),
    };
  });
}
