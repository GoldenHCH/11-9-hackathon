import type { IAttendee, IProfile, Seniority } from '../../shared/src/index';
import {
  companyTypes,
  cultureNames,
  extraLanguages,
  firstTimerSentences,
  goalLeadIns,
  goalPool,
  handleSuffixes,
  openers,
  seniorityLabels,
  studentHeadlines,
  studentSentences,
  topicProfiles,
  welcomerSentences,
} from './attendee-pools.constants';
import type { IPersonaSpec, ITopicProfile } from './data-scripts.interfaces';
import type { IPrng } from './prng.interfaces';
import { personaSpecs, personaTopics } from './personas.constants';
import { slugify } from './slug.helper';
import { addMinutes } from './time.helper';

const topicByKeyword = new Map<string, ITopicProfile>(topicProfiles.map((topic) => [topic.keyword, topic]));

export function lookupTopic(keyword: string): ITopicProfile {
  const topic = topicByKeyword.get(keyword);
  if (!topic) {
    throw new Error(`Unknown topic ${keyword}`);
  }

  return topic;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function pickSeniority(prng: IPrng): Seniority {
  return prng.weightedPick<Seniority>(
    ['student', 'junior', 'mid', 'senior', 'staff', 'principal'],
    [6, 17, 30, 28, 12, 7],
  );
}

function pickTopics(prng: IPrng): string[] {
  const allKeywords = topicProfiles.map((topic) => topic.keyword);
  const primary = prng.pick(allKeywords);
  const wantedCount = prng.weightedPick([2, 3, 4, 5], [25, 40, 25, 10]);
  const chosen = [primary];
  while (chosen.length < wantedCount) {
    const relatedPool = lookupTopic(chosen[0]).related.filter((keyword) => !chosen.includes(keyword));
    const fallbackPool = allKeywords.filter((keyword) => !chosen.includes(keyword));
    const pool = relatedPool.length > 0 && prng.chance(0.65) ? relatedPool : fallbackPool;
    chosen.push(prng.pick(pool));
  }

  return chosen;
}

function overlapsPersonasTooMuch(topics: string[]): boolean {
  return topics.filter((topic) => personaTopics.includes(topic)).length > 2;
}

function buildHeadline(prng: IPrng, seniority: Seniority, primary: ITopicProfile): string {
  if (seniority === 'student') {
    return prng.pick(studentHeadlines);
  }
  const role = prng.pick(primary.roles);
  const label = seniorityLabels[seniority] ?? '';

  return `${label}${label ? role : capitalize(role)} at ${prng.pick(companyTypes)}`;
}

function buildProfileText(
  prng: IPrng,
  topics: string[],
  seniority: Seniority,
  firstTimer: boolean,
  welcomer: boolean,
): string {
  const primary = lookupTopic(topics[0]);
  const secondary = lookupTopic(topics[1]);
  const sentences: string[] = [];
  if (seniority === 'student') {
    const readable = topics.slice(0, 2).map((keyword) => keyword.replace(/-/g, ' '));
    sentences.push(`I am still studying and spend most of my free time learning about ${readable.join(' and ')}.`);
    sentences.push(prng.pick(studentSentences));
  } else {
    sentences.push(`${prng.pick(openers)} ${prng.pick(primary.works)}.`);
    sentences.push(prng.pick(primary.struggles));
  }
  if (firstTimer) {
    sentences.push(prng.pick(firstTimerSentences));
  } else if (welcomer) {
    sentences.push(prng.pick(welcomerSentences));
  } else if (seniority !== 'student' && prng.chance(0.5)) {
    sentences.push(`On the side I ${secondary.alsoPhrase}.`);
  } else {
    sentences.push(`${prng.pick(goalLeadIns)} ${prng.pick(goalPool)}.`);
  }

  return sentences.join(' ');
}

function buildLanguages(prng: IPrng, nativeLanguage: string | undefined): string[] {
  const languages = ['English'];
  if (nativeLanguage && prng.chance(0.9)) {
    languages.push(nativeLanguage);
  }
  if (prng.chance(0.1)) {
    const extra = prng.pick(extraLanguages);
    if (!languages.includes(extra)) {
      languages.push(extra);
    }
  }

  return languages;
}

function buildHandle(prng: IPrng, given: string, family: string, usedHandles: Set<string>): string {
  const givenSlug = slugify(given);
  const familySlug = slugify(family);
  for (let attempt = 0; attempt < 30; attempt++) {
    const style = prng.int(0, 4);
    const digits = String(prng.int(2, 99));
    let handle: string;
    if (style === 0) {
      handle = `${givenSlug}-${familySlug}`;
    } else if (style === 1) {
      handle = `${givenSlug}${familySlug.charAt(0)}${digits}`;
    } else if (style === 2) {
      handle = `${givenSlug}-${familySlug.charAt(0)}-${prng.pick(handleSuffixes)}`;
    } else if (style === 3) {
      handle = `${familySlug}-${givenSlug.charAt(0)}${digits}`;
    } else {
      handle = `${prng.pick(handleSuffixes)}-${givenSlug}${digits}`;
    }
    if (handle.length <= 26 && !usedHandles.has(handle)) {
      return handle;
    }
  }

  return `${givenSlug}-${familySlug}-${prng.int(100, 999)}`;
}

function pickOffersAndAsks(prng: IPrng, topics: string[]): { offers: string[]; asks: string[] } {
  const primary = lookupTopic(topics[0]);
  const secondary = lookupTopic(topics[1]);
  const offers = [prng.pick(primary.offers)];
  const asks = [prng.pick(primary.asks)];
  if (prng.chance(0.5)) {
    offers.push(prng.pick(secondary.offers));
  }
  if (prng.chance(0.6)) {
    asks.push(prng.pick(secondary.asks));
  }

  return { offers: [...new Set(offers)], asks: [...new Set(asks)] };
}

export function buildPersonaAttendee(spec: IPersonaSpec): IAttendee {
  const profile: IProfile = {
    topics: spec.topics,
    seniority: spec.seniority,
    goals: spec.goals,
    offers: spec.offers,
    asks: spec.asks,
    languages: spec.languages,
    firstTimer: spec.firstTimer,
    welcomer: spec.welcomer,
  };

  return {
    id: spec.id,
    handle: spec.handle,
    name: spec.name,
    headline: spec.headline,
    profileText: spec.profileText,
    profile,
    visible: true,
    xp: 0,
    badges: [],
    createdAt: spec.createdAt,
  };
}

export function generateAttendees(prng: IPrng, generatedCount: number, seedNow: string): IAttendee[] {
  const usedHandles = new Set<string>(personaSpecs.map((spec) => spec.handle));
  const usedNames = new Set<string>(personaSpecs.map((spec) => spec.name));
  const attendees: IAttendee[] = [];
  const accountOpensAt = addMinutes(seedNow, -60 * 24 * 21);

  while (attendees.length < generatedCount) {
    const culture = prng.pick(cultureNames);
    const given = prng.pick(culture.givenNames);
    const family = prng.pick(culture.familyNames);
    const fullName = `${given} ${family}`;
    if (usedNames.has(fullName)) {
      continue;
    }

    let topics = pickTopics(prng);
    while (overlapsPersonasTooMuch(topics)) {
      topics = pickTopics(prng);
    }

    usedNames.add(fullName);
    const handle = buildHandle(prng, given, family, usedHandles);
    usedHandles.add(handle);
    const seniority = pickSeniority(prng);
    const firstTimer = prng.chance(0.23);
    const welcomer = !firstTimer && seniority !== 'student' && prng.chance(0.19);
    const { offers, asks } = pickOffersAndAsks(prng, topics);
    const goals = prng.shuffle(goalPool).slice(0, prng.int(1, 3));
    const number = attendees.length + 1;
    const createdAt = addMinutes(accountOpensAt, prng.int(0, 60 * 24 * 20));

    attendees.push({
      id: `att-${String(number).padStart(3, '0')}`,
      handle,
      name: fullName,
      headline: buildHeadline(prng, seniority, lookupTopic(topics[0])),
      profileText: buildProfileText(prng, topics, seniority, firstTimer, welcomer),
      profile: {
        topics,
        seniority,
        goals,
        offers,
        asks,
        languages: buildLanguages(prng, culture.nativeLanguage),
        firstTimer,
        welcomer,
      },
      visible: prng.chance(0.9),
      xp: 0,
      badges: [],
      createdAt,
    });
  }

  return attendees;
}
