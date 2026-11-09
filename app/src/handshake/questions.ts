import { createHash } from 'node:crypto';
import { phraseHandshakeQuestion } from '../ai/handshake';
import { esOptions, getEsClient } from '../es/client';
import { kindIsOrLegacy } from '../es/doc-kind.helper';
import { esTimeouts, indexNames } from '../es/es.constants';
import { docKinds } from '../types/connections.constants';
import { IHandshakeQuestion } from '../types/internal.interfaces';
import { IAttendee } from '../types/kubequest.interfaces';

interface IFallbackQuestion {
  ask: string;
  answer: string;
}

const MAX_TOPIC_CHARS = 40;
const MAX_WORKING_ON_CHARS = 80;

const fallbackQuestions: IFallbackQuestion[] = [
  { ask: "what's their favorite CNCF project?", answer: "What's your favorite CNCF project?" },
  { ask: 'which language do they write most at work?', answer: 'Which language do you write most at work?' },
  { ask: 'what city did they fly in from?', answer: 'What city did you fly in from?' },
  { ask: 'which debugging tool do they reach for first?', answer: 'Which debugging tool do you reach for first?' },
  { ask: 'what would they automate first if they had a free week?', answer: 'What would you automate first if you had a free week?' },
];

function cleanPhrase(value: string, maxChars: number): string {
  return value.replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().replace(/[.!?]+$/, '').slice(0, maxChars);
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function pickBySeed<T>(items: T[], seed: string): T {
  const index = createHash('sha256').update(seed).digest().readUInt32BE(0) % items.length;

  return items[index] as T;
}

async function countBoothNotes(attendeeId: string): Promise<number> {
  const response = await getEsClient().count(
    {
      index: indexNames.BOOTH_NOTES,
      query: { bool: { filter: [{ term: { attendeeId } }, kindIsOrLegacy(docKinds.BOOTH_NOTE), { range: { xpAwarded: { gt: 0 } } }] } },
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return response.count ?? 0;
}

async function countTalksAttended(attendeeId: string): Promise<number> {
  const response = await getEsClient().count(
    {
      index: indexNames.XP_EVENTS,
      query: { bool: { filter: [{ term: { attendeeId } }, { term: { type: 'check_in' } }, { exists: { field: 'talkId' } }] } },
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return response.count ?? 0;
}

function sharedTopicQuestion(answerer: IAttendee, topic: string): IHandshakeQuestion {
  const cleanTopic = cleanPhrase(topic, MAX_TOPIC_CHARS);

  return {
    question: `You both work on ${cleanTopic}. Ask @${answerer.handle}: what's their go-to tool for ${cleanTopic}?`,
    answererQuestion: `What's your go-to tool for ${cleanTopic}?`,
    source: 'shared_topic',
    reason: `You both care about ${cleanTopic}`,
  };
}

function workingOnQuestion(answerer: IAttendee): IHandshakeQuestion {
  const workingOn = lowerFirst(cleanPhrase(answerer.workingOn, MAX_WORKING_ON_CHARS));

  return {
    question: `Ask @${answerer.handle}: what's the one tool they couldn't do without for ${workingOn}?`,
    answererQuestion: `What's the one tool you couldn't do without for ${workingOn}?`,
    source: 'working_on',
    reason: `@${answerer.handle} is working on ${workingOn}`,
  };
}

async function templateQuestion(asker: IAttendee, answerer: IAttendee, sharedTopics: string[], seed: string): Promise<IHandshakeQuestion> {
  const topic = sharedTopics.find((value) => value.trim() !== '');

  if (topic) {
    return sharedTopicQuestion(answerer, topic);
  }

  const [boothNotes, talks] = await Promise.all([countBoothNotes(answerer.id), countTalksAttended(answerer.id)]);

  if (boothNotes > 0) {
    return {
      question: `Ask @${answerer.handle}: which booth has been their favorite so far?`,
      answererQuestion: 'Which booth has been your favorite so far?',
      source: 'booth_note',
      reason: `@${answerer.handle} has taken notes at ${boothNotes} ${boothNotes === 1 ? 'booth' : 'booths'}`,
    };
  }

  if (talks > 0) {
    return {
      question: `Ask @${answerer.handle}: which talk would they tell you not to miss?`,
      answererQuestion: 'Which talk would you tell someone not to miss?',
      source: 'talk',
      reason: `@${answerer.handle} has been to ${talks} ${talks === 1 ? 'talk' : 'talks'}`,
    };
  }

  if (answerer.workingOn.trim() !== '') {
    return workingOnQuestion(answerer);
  }

  const fallback = pickBySeed(fallbackQuestions, `${asker.id}:${seed}`);

  return {
    question: `Ask @${answerer.handle}: ${fallback.ask}`,
    answererQuestion: fallback.answer,
    source: 'fallback',
  };
}

export async function chooseHandshakeQuestion(asker: IAttendee, answerer: IAttendee, sharedTopics: string[], seed: string): Promise<IHandshakeQuestion> {
  const chosen = await templateQuestion(asker, answerer, sharedTopics, seed);
  const phrased = await phraseHandshakeQuestion(answerer.handle, chosen.question);

  return { ...chosen, question: phrased };
}
