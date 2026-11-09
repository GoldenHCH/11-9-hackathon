import type { estypes } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { gameRules } from '../types/kubequest.constants';
import { IAttendee, IIntro, IPersonMatch } from '../types/kubequest.interfaces';
import { worldNow } from '../world/clock';
import { attendeeSourceExcludes, getAttendee, hitSources, profileQueryText, sharedTopics, toMatchPlayer } from './match-data';

export interface IRecommendPeopleOptions {
  hereOnly?: boolean;
  limit?: number;
}

const defaultLimit = 5;
const recentlySeenMinutes = 30;

function startOfTodayIso(nowMs: number): string {
  const conferenceOffsetMs = 7 * 3600000;
  const localDay = new Date(nowMs - conferenceOffsetMs);
  localDay.setUTCHours(0, 0, 0, 0);

  return new Date(localDay.getTime() + conferenceOffsetMs).toISOString();
}

async function excludedPartnerIds(attendeeId: string, nowMs: number): Promise<Set<string>> {
  const response = await getEsClient().search<IIntro>(
    {
      index: indexNames.INTROS,
      size: 500,
      _source: ['fromId', 'toId'],
      query: {
        bool: {
          filter: [{ bool: { should: [{ term: { fromId: attendeeId } }, { term: { toId: attendeeId } }], minimum_should_match: 1 } }],
          should: [
            { terms: { status: ['proposed', 'accepted'] } },
            { bool: { filter: [{ term: { status: 'declined' } }, { range: { proposedAt: { gte: startOfTodayIso(nowMs) } } }] } },
          ],
          minimum_should_match: 1,
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return new Set(hitSources(response.hits.hits).map((intro) => (intro.fromId === attendeeId ? intro.toId : intro.fromId)));
}

function peopleFilter(me: IAttendee, excludeIds: string[], hereOnly: boolean): estypes.QueryDslQueryContainer {
  const filter: estypes.QueryDslQueryContainer[] = [{ term: { visible: true } }, { term: { 'settings.meetingOn': true } }];

  if (hereOnly && me.lastLocationId) {
    const hereSince = new Date(worldNow().getTime() - gameRules.BUSYNESS_WINDOW_MINUTES * 60000).toISOString();
    filter.push({ term: { lastLocationId: me.lastLocationId } }, { range: { lastSeenAt: { gte: hereSince } } });
  }

  return {
    bool: {
      filter,
      must_not: [{ ids: { values: excludeIds } }, { term: { blockedIds: me.id } }],
    },
  };
}

function boostQuery(me: IAttendee, queryText: string, filter: estypes.QueryDslQueryContainer, nowMs: number): estypes.QueryDslQueryContainer {
  const topics = me.profile?.topics ?? [];
  const should: estypes.QueryDslQueryContainer[] = [
    { range: { lastSeenAt: { gte: new Date(nowMs - recentlySeenMinutes * 60000).toISOString(), boost: 1.5 } } },
  ];

  if (queryText !== '') {
    should.push({ multi_match: { query: queryText, fields: ['workingOn^2', 'headline'] } });
  }

  if (topics.length > 0) {
    should.push({ terms: { 'profile.topics': topics, boost: 3 } });
  }

  if (me.profile?.firstTimer) {
    should.push({ term: { 'profile.welcomer': { value: true, boost: 4 } } });
  }

  if (me.profile?.welcomer) {
    should.push({ term: { 'profile.firstTimer': { value: true, boost: 4 } } });
  }

  if (me.lastLocationId) {
    should.push({ term: { lastLocationId: { value: me.lastLocationId, boost: 1.5 } } });
  }

  return { bool: { filter: [filter], should } };
}

async function hybridPeople(
  me: IAttendee,
  filter: estypes.QueryDslQueryContainer,
  size: number,
  nowMs: number,
): Promise<estypes.SearchHit<IAttendee>[]> {
  const client = getEsClient();
  const queryText = profileQueryText(me);
  const keyword = boostQuery(me, queryText, filter, nowMs);

  if (queryText === '') {
    const response = await client.search<IAttendee>(
      { index: indexNames.ATTENDEES, size, query: keyword, _source_excludes: attendeeSourceExcludes },
      esOptions(esTimeouts.SEARCH_MS),
    );

    return response.hits.hits;
  }

  try {
    const response = await client.search<IAttendee>(
      {
        index: indexNames.ATTENDEES,
        size,
        _source_excludes: attendeeSourceExcludes,
        retriever: {
          rrf: {
            retrievers: [
              { standard: { query: { bool: { filter: [filter], must: [{ semantic: { field: 'profileText', query: queryText } }] } } } },
              { standard: { query: keyword } },
            ],
            rank_window_size: Math.max(50, size),
            rank_constant: 20,
          },
        },
      },
      esOptions(esTimeouts.SEARCH_MS),
    );

    return response.hits.hits;
  } catch (error) {
    logger.warn({ err: error }, 'hybrid people search failed, falling back to keyword search');

    const response = await client.search<IAttendee>(
      { index: indexNames.ATTENDEES, size, query: keyword, _source_excludes: attendeeSourceExcludes },
      esOptions(esTimeouts.SEARCH_MS),
    );

    return response.hits.hits;
  }
}

function reasonFor(me: IAttendee, them: IAttendee, shared: string[], sameRoom: boolean): string {
  const parts: string[] = [];

  if (me.profile?.firstTimer && them.profile?.welcomer) {
    parts.push('Happy to welcome a first-timer');
  } else if (me.profile?.welcomer && them.profile?.firstTimer) {
    parts.push('First KubeCon, could use a welcome');
  }

  if (shared.length > 0) {
    parts.push(`Both into ${shared.slice(0, 2).join(' and ')}`);
  } else if (them.workingOn) {
    parts.push(`Working on ${them.workingOn.slice(0, 80)}`);
  }

  if (sameRoom) {
    parts.push('In the same room right now');
  }

  return parts.length > 0 ? parts.join('. ') : 'Works on similar things';
}

export async function recommendPeopleFor(attendeeId: string, opts: IRecommendPeopleOptions = {}): Promise<IPersonMatch[]> {
  const nowMs = Date.now();
  const limit = opts.limit ?? defaultLimit;
  const hereOnly = opts.hereOnly ?? false;
  const me = await getAttendee(attendeeId);

  if (hereOnly && !me.lastLocationId) {
    return [];
  }

  const partners = await excludedPartnerIds(attendeeId, nowMs);
  const excludeIds = [...new Set([attendeeId, ...(me.blockedIds ?? []), ...partners])];
  const hits = await hybridPeople(me, peopleFilter(me, excludeIds, hereOnly), limit, nowMs);

  return hits.flatMap((hit) => {
    if (!hit._source) {
      return [];
    }

    const them: IAttendee = { ...hit._source, id: hit._id ?? hit._source.id };
    const shared = sharedTopics(me.profile?.topics ?? [], them.profile?.topics ?? []);
    const sameRoom = me.lastLocationId !== undefined && them.lastLocationId === me.lastLocationId;

    return [{ player: toMatchPlayer(them), score: hit._score ?? 0, sharedTopics: shared, reason: reasonFor(me, them, shared, sameRoom), sameRoom }];
  });
}
