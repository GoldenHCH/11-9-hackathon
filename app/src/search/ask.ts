import { trace } from '@opentelemetry/api';
import type { estypes } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { plannedTalkIds } from '../itinerary/itinerary.store';
import { logger } from '../observability/logger';
import { publicIdFor } from '../profile/public-id';
import { IAttendee, ILocation, ITalk } from '../types/kubequest.interfaces';
import { askHighlightFields, askLexicalFields, askResultKinds, askSemanticFields, askSettings, askSourceFields, boothLocationKinds } from './search.constants';
import { IAskBooth, IAskFilters, IAskInput, IAskPerson, IAskResult, IAskTalk } from './search.interfaces';
import { AskResultKind, SummarySource } from './search.types';

type QueryContainer = estypes.QueryDslQueryContainer;
type Hit = estypes.SearchHit<Record<string, unknown>>;

interface IAskRequester {
  id?: string;
  topics: string[];
  blockedIds: string[];
  planned: Set<string>;
}

interface ITalkSource extends Partial<ITalk> {
  summary?: string;
  summarySource?: SummarySource;
  transcript?: string;
}

interface IAttempt {
  mode: IAskResult['mode'];
  body: Omit<estypes.SearchRequest, 'index'>;
}

export function talkResultId(id: string): string {
  return `talk:${id}`;
}

export function personResultId(publicId: string): string {
  return `person:${publicId}`;
}

export function boothResultId(id: string): string {
  return `booth:${id}`;
}

function wantedKinds(filters: IAskFilters | undefined): Set<AskResultKind> {
  return new Set(filters?.kinds && filters.kinds.length > 0 ? filters.kinds : askResultKinds);
}

function scopeFilter(filters: IAskFilters | undefined, requester: IAskRequester): QueryContainer {
  const kinds = wantedKinds(filters);
  const should: QueryContainer[] = [];

  if (kinds.has('talk')) {
    const talkFilter: QueryContainer[] = [{ term: { _index: indexNames.TALKS } }];

    if (filters?.track) {
      talkFilter.push({ term: { track: filters.track } });
    }

    should.push({ bool: { filter: talkFilter } });
  }

  if (kinds.has('person')) {
    const mustNot: QueryContainer[] = [];

    if (requester.id) {
      mustNot.push({ ids: { values: [requester.id] } }, { term: { blockedIds: requester.id } });
    }

    if (requester.blockedIds.length > 0) {
      mustNot.push({ ids: { values: requester.blockedIds } });
    }

    should.push({
      bool: {
        filter: [{ term: { _index: indexNames.ATTENDEES } }, { term: { visible: true } }, { term: { 'settings.meetingOn': true } }],
        must_not: mustNot,
      },
    });
  }

  if (kinds.has('booth')) {
    should.push({ bool: { filter: [{ term: { _index: indexNames.LOCATIONS } }, { terms: { kind: boothLocationKinds } }] } });
  }

  return { bool: { should, minimum_should_match: 1 } };
}

function lexicalQuery(query: string): QueryContainer {
  return { multi_match: { query, fields: askLexicalFields, type: 'best_fields', fuzziness: 'AUTO', lenient: true } };
}

function semanticQuery(query: string): QueryContainer {
  return { dis_max: { queries: askSemanticFields.map(({ field, boost }) => ({ match: { [field]: { query, boost } } })), tie_breaker: askSettings.SEMANTIC_TIE_BREAKER } };
}

function hybridRetriever(query: string, scope: QueryContainer): estypes.RetrieverContainer {
  return {
    rrf: {
      retrievers: [
        { standard: { query: { bool: { must: [lexicalQuery(query)], filter: [scope] } } } },
        { standard: { query: { bool: { must: [semanticQuery(query)], filter: [scope] } } } },
      ],
      rank_window_size: askSettings.RANK_WINDOW,
      rank_constant: askSettings.RANK_CONSTANT,
    },
  };
}

function semanticHighlight(): estypes.SearchHighlight {
  return {
    fields: Object.fromEntries(
      askHighlightFields.map((field) => [field, { type: 'semantic', number_of_fragments: 1, order: 'score' } as estypes.SearchHighlightField]),
    ),
  };
}

async function runSearch(body: Omit<estypes.SearchRequest, 'index'>): Promise<estypes.SearchResponse<Record<string, unknown>>> {
  return getEsClient().search<Record<string, unknown>>(
    {
      index: [indexNames.TALKS, indexNames.ATTENDEES, indexNames.LOCATIONS],
      ignore_unavailable: true,
      allow_no_indices: true,
      timeout: askSettings.SERVER_TIMEOUT,
      size: askSettings.POOL_SIZE,
      _source: { includes: askSourceFields },
      ...body,
    },
    esOptions(esTimeouts.SEARCH_MS),
  );
}

async function searchWithAttempts(attempts: IAttempt[]): Promise<{ mode: IAskResult['mode']; response: estypes.SearchResponse<Record<string, unknown>> }> {
  let lastError: unknown;

  for (const attempt of attempts) {
    try {
      return { mode: attempt.mode, response: await runSearch(attempt.body) };
    } catch (error) {
      lastError = error;
      trace.getActiveSpan()?.addEvent('ask.attempt_failed', { mode: attempt.mode, highlighted: attempt.body.highlight !== undefined });
      logger.warn({ err: error, mode: attempt.mode }, 'ask search attempt failed');
    }
  }

  throw lastError;
}

async function loadRequester(attendeeId: string | undefined): Promise<IAskRequester> {
  const requester: IAskRequester = { id: attendeeId, topics: [], blockedIds: [], planned: new Set() };

  if (!attendeeId) {
    return requester;
  }

  try {
    const [response, planned] = await Promise.all([
      getEsClient().get<Partial<IAttendee>>(
        { index: indexNames.ATTENDEES, id: attendeeId, _source_includes: ['profile.topics', 'blockedIds'] },
        esOptions(esTimeouts.DEFAULT_MS),
      ),
      plannedTalkIds(attendeeId),
    ]);
    requester.topics = response._source?.profile?.topics ?? [];
    requester.blockedIds = response._source?.blockedIds ?? [];
    requester.planned = planned;
  } catch (error) {
    logger.warn({ err: error }, 'ask requester lookup failed');
  }

  return requester;
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();

  if (clean.length <= max) {
    return clean;
  }

  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');

  return `${cut.slice(0, lastSpace > max / 2 ? lastSpace : max)}…`;
}

function firstHighlight(hit: Hit, field: string): string | undefined {
  const fragment = hit.highlight?.[field]?.[0];

  return fragment ? clip(fragment, askSettings.FRAGMENT_CHARS) : undefined;
}

function toTalk(hit: Hit, requester: IAskRequester, now: number): IAskTalk {
  const source = hit._source as ITalkSource;
  const id = hit._id ?? '';
  const summaryHighlight = firstHighlight(hit, 'summary');
  const transcriptHighlight = firstHighlight(hit, 'transcript');
  const start = source.start ?? '';
  let snippetSource: IAskTalk['snippetSource'] = 'abstract';
  let snippet = clip(source.abstract ?? '', askSettings.SNIPPET_CHARS);
  let highlight: string | undefined;

  if (transcriptHighlight) {
    snippetSource = 'transcript';
    highlight = transcriptHighlight;
  } else if (source.summary) {
    snippetSource = 'summary';
    snippet = clip(source.summary, askSettings.SNIPPET_CHARS);
    highlight = summaryHighlight;
  }

  return {
    resultId: talkResultId(id),
    id,
    title: source.title ?? '',
    track: source.track ?? 'other',
    sessionType: source.sessionType ?? 'breakout',
    speakers: source.speakers ?? [],
    start,
    end: source.end ?? '',
    room: source.room ?? '',
    building: source.building ?? '',
    level: source.level ?? '',
    locationId: source.locationId ?? '',
    snippet,
    highlight,
    snippetSource,
    summarySource: snippetSource === 'summary' ? (source.summarySource ?? 'ai_from_abstract') : undefined,
    inItinerary: requester.id ? requester.planned.has(id) : undefined,
    quizAvailable: start !== '' && Date.parse(start) <= now,
    isBoss: source.isBoss ?? false,
  };
}

function whyLine(source: Partial<IAttendee>, shared: string[], query: string): string {
  if (shared.length > 0) {
    return `You both follow ${shared.slice(0, 2).join(' and ')}.`;
  }

  const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  const topics = source.profile?.topics ?? [];
  const matched = topics.find((topic) => words.some((word) => topic.toLowerCase().includes(word)));

  if (matched) {
    return `Into ${matched}, which matches your search.`;
  }

  if (source.workingOn) {
    return `Working on ${clip(source.workingOn, 90)}`;
  }

  return 'Their profile matches your search.';
}

function toPerson(hit: Hit, requester: IAskRequester, query: string): IAskPerson {
  const source = hit._source as Partial<IAttendee>;
  const publicId = publicIdFor(hit._id ?? '');
  const topics = source.profile?.topics ?? [];
  const mine = new Set(requester.topics.map((topic) => topic.toLowerCase()));
  const sharedTopics = topics.filter((topic) => mine.has(topic.toLowerCase()));

  return {
    resultId: personResultId(publicId),
    publicId,
    handle: source.handle ?? '',
    faceSeed: source.faceSeed ?? source.handle ?? publicId,
    headline: source.headline ?? clip(source.workingOn ?? '', 90),
    topics: topics.slice(0, 5),
    sharedTopics,
    why: whyLine(source, sharedTopics, query),
    isSpeaker: source.isSpeaker ?? false,
  };
}

function toBooth(hit: Hit): IAskBooth {
  const source = hit._source as Partial<ILocation>;
  const id = hit._id ?? '';

  return {
    resultId: boothResultId(id),
    locationId: id,
    name: source.name ?? '',
    boothNumber: source.boothNumber,
    sponsorTier: source.sponsorTier,
    askAbout: source.askAbout ? clip(source.askAbout, 140) : undefined,
    building: source.building ?? '',
    level: source.level ?? '',
    zone: source.zone,
  };
}

export async function ask(input: IAskInput): Promise<IAskResult> {
  const span = trace.getActiveSpan();
  const query = input.query.trim();
  const requester = await loadRequester(input.attendeeId);
  const scope = scopeFilter(input.filters, requester);
  const hybrid = hybridRetriever(query, scope);
  const { mode, response } = await searchWithAttempts([
    { mode: 'hybrid', body: { retriever: hybrid, highlight: semanticHighlight() } },
    { mode: 'hybrid', body: { retriever: hybrid } },
    { mode: 'lexical', body: { query: { bool: { must: [lexicalQuery(query)], filter: [scope] } } } },
  ]);
  const now = Date.now();
  const result: IAskResult = { query, mode, tookMs: response.took, talks: [], people: [], booths: [], topIds: [] };

  for (const hit of response.hits.hits) {
    if (!hit._source || !hit._id) {
      continue;
    }

    if (hit._index.startsWith(indexNames.TALKS) && result.talks.length < askSettings.PER_GROUP) {
      const talk = toTalk(hit, requester, now);
      result.talks.push(talk);
      result.topIds.push(talk.resultId);
    } else if (hit._index.startsWith(indexNames.ATTENDEES) && result.people.length < askSettings.PER_GROUP) {
      const person = toPerson(hit, requester, query);
      result.people.push(person);
      result.topIds.push(person.resultId);
    } else if (hit._index.startsWith(indexNames.LOCATIONS) && result.booths.length < askSettings.PER_GROUP) {
      const booth = toBooth(hit);
      result.booths.push(booth);
      result.topIds.push(booth.resultId);
    }
  }

  result.topIds = result.topIds.slice(0, askSettings.TOP_FOR_ANSWER);

  span?.setAttributes({
    'kubequest.ask.mode': mode,
    'kubequest.ask.took_ms': response.took,
    'kubequest.ask.talks': result.talks.length,
    'kubequest.ask.people': result.people.length,
    'kubequest.ask.booths': result.booths.length,
  });

  return result;
}
