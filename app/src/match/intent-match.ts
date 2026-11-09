import type { estypes } from '@elastic/elasticsearch';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { topicRules } from '../profile/profile.constants';
import { AttendeeGoal } from '../types/intent.interfaces';
import { IAttendee, IIntro } from '../types/kubequest.interfaces';
import { attendeeSourceExcludes, hitSources } from './match-data';

const EXPLORING_BOOST = 8;
const ROLE_BOOST = 6;
const MIN_TEXT_KEYWORD = 3;
const MIN_WILDCARD_KEYWORD = 5;

export const matchSourceExcludes = attendeeSourceExcludes.filter((field) => field !== 'intent' && field !== 'skills' && field !== 'seniority');

function slug(value: string): string {
  return value.toLowerCase().trim().replace(/\s+/g, '-');
}

function fieldKeywords(field: string): string[] {
  const rule = topicRules.find((candidate) => candidate.topic.toLowerCase() === field.toLowerCase());

  return Array.from(new Set([field.toLowerCase(), ...(rule?.keywords ?? [])]));
}

function goalsOf(attendee: IAttendee): AttendeeGoal[] {
  return attendee.intent?.goals ?? [];
}

function exploringFieldOf(attendee: IAttendee): string | undefined {
  return goalsOf(attendee).includes('exploring') && attendee.intent?.exploringField ? attendee.intent.exploringField : undefined;
}

function experiencedQuery(): estypes.QueryDslQueryContainer {
  return { bool: { should: [{ term: { 'profile.welcomer': true } }, { term: { 'profile.firstTimer': false } }], minimum_should_match: 1 } };
}

function fieldQuery(field: string): estypes.QueryDslQueryContainer {
  const keywords = fieldKeywords(field);
  const slugs = keywords.map(slug);

  return {
    bool: {
      should: [
        { terms: { 'profile.topics': [...slugs, ...slugs.map((value) => `${value}s`), field] } },
        { terms: { skills: keywords } },
        ...slugs.filter((value) => value.length >= MIN_WILDCARD_KEYWORD).map((value) => ({ wildcard: { 'profile.topics': { value: `*${value}*` } } })),
        { multi_match: { query: keywords.filter((value) => value.length >= MIN_TEXT_KEYWORD).join(' '), fields: ['workingOn^2', 'headline', 'offers'] } },
      ],
      minimum_should_match: 1,
    },
  };
}

export function exploringRetrieverQuery(me: IAttendee, filter: estypes.QueryDslQueryContainer): estypes.QueryDslQueryContainer | undefined {
  const field = exploringFieldOf(me);

  return field ? { bool: { filter: [filter, experiencedQuery()], must: [fieldQuery(field)] } } : undefined;
}

export function exploringQueryText(me: IAttendee): string | undefined {
  const field = exploringFieldOf(me);

  return field ? `Works on ${field} every day.` : undefined;
}

function counterpartGoal(goal: AttendeeGoal): AttendeeGoal | undefined {
  if (goal === 'hiring') {
    return 'job_seeking';
  }

  return goal === 'job_seeking' ? 'hiring' : undefined;
}

export function intentBoosts(me: IAttendee): estypes.QueryDslQueryContainer[] {
  const boosts: estypes.QueryDslQueryContainer[] = [];
  const field = exploringFieldOf(me);

  if (field) {
    boosts.push({ bool: { filter: [experiencedQuery()], must: [fieldQuery(field)], boost: EXPLORING_BOOST } });
  }

  const skillTerms = [...(me.skills ?? []), ...(me.profile?.topics ?? [])];

  for (const goal of goalsOf(me)) {
    const wanted = counterpartGoal(goal);

    if (!wanted) {
      continue;
    }

    const should: estypes.QueryDslQueryContainer[] = skillTerms.length > 0 ? [{ terms: { skills: skillTerms } }, { terms: { 'profile.topics': skillTerms } }] : [];

    if (me.seniority) {
      should.push({ term: { seniority: me.seniority } });
    }

    boosts.push({ bool: { filter: [{ term: { 'intent.goals': wanted } }], should, boost: ROLE_BOOST } });
  }

  return boosts;
}

function lower(values: string[] | undefined): string[] {
  return (values ?? []).map((value) => value.toLowerCase());
}

function worksOnField(them: IAttendee, field: string): boolean {
  const keywords = fieldKeywords(field).filter((value) => value.length >= MIN_TEXT_KEYWORD);
  const tags = [...lower(them.profile?.topics), ...lower(them.skills)];
  const text = `${them.workingOn ?? ''} ${them.headline ?? ''}`.toLowerCase();

  return keywords.some((keyword) => tags.some((tag) => tag.includes(slug(keyword))) || text.includes(keyword));
}

function sharedSkills(me: IAttendee, them: IAttendee): string[] {
  const mine = new Set([...lower(me.skills), ...lower(me.profile?.topics)]);

  return [...(them.skills ?? []), ...(them.profile?.topics ?? [])].filter((value) => mine.has(value.toLowerCase())).slice(0, 2);
}

export function intentReason(me: IAttendee, them: IAttendee): string | undefined {
  const field = exploringFieldOf(me);
  const experienced = them.profile?.welcomer === true || them.profile?.firstTimer === false;

  if (field && experienced && worksOnField(them, field)) {
    return `@${them.handle} works on ${field} every day; you're exploring it`;
  }

  const theirGoals = goalsOf(them);
  const skills = sharedSkills(me, them);
  const across = skills.length > 0 ? ` in ${skills.join(' and ')}` : '';

  if (goalsOf(me).includes('hiring') && theirGoals.includes('job_seeking')) {
    return `@${them.handle} is looking for a new role${across}; you're hiring`;
  }

  if (goalsOf(me).includes('job_seeking') && theirGoals.includes('hiring')) {
    return `@${them.handle} is hiring${across}; you're looking for a role`;
  }

  return undefined;
}

export async function playersMatchedToday(sinceIso: string): Promise<string[]> {
  const response = await getEsClient().search<IIntro>(
    {
      index: indexNames.INTROS,
      size: 1000,
      _source: ['fromId', 'toId'],
      query: { bool: { filter: [{ range: { proposedAt: { gte: sinceIso } } }], must_not: [{ terms: { status: ['cancelled'] } }] } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return Array.from(new Set(hitSources(response.hits.hits).flatMap((intro) => [intro.fromId, intro.toId])));
}

export function lightLimitQuery(matchedToday: string[]): estypes.QueryDslQueryContainer | undefined {
  return matchedToday.length > 0 ? { bool: { filter: [{ term: { 'intent.socialLevel': 'light' } }, { ids: { values: matchedToday } }] } } : undefined;
}
