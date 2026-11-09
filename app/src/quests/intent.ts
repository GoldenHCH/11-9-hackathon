import { AttendeeGoal, IAttendeeIntent } from '../types/intent.interfaces';
import { QuestType } from '../types/kubequest.types';
import type { ICandidate, IOfferContext } from './offers';

const LAST_PRIORITY = 99;
const MEET_EVENT_TYPES = new Set(['handshake']);

type PriorityShift = Partial<Record<QuestType, number>>;

const GOAL_SHIFTS: Partial<Record<AttendeeGoal, PriorityShift>> = {
  talks: { attend: -3, quiz: -2, chat: 2 },
  booth: { outpost: 3, chat: -2 },
  hiring: { chat: -2 },
  job_seeking: { chat: -2 },
  exploring: { chat: -1, attend: -1 },
  community: { chat: -1 },
  deep_dive: { attend: -1, quiz: -1 },
};

function shifted(candidates: ICandidate[], goals: AttendeeGoal[]): ICandidate[] {
  return candidates.map((candidate) => {
    const shift = goals.reduce((total, goal) => total + (GOAL_SHIFTS[goal]?.[candidate.quest.type] ?? 0), 0);

    return { ...candidate, priority: candidate.priority + shift };
  });
}

function capType(candidates: ICandidate[], type: QuestType, max: number): ICandidate[] {
  let kept = 0;

  return candidates.filter((candidate) => candidate.quest.type !== type || kept++ < max);
}

function meetsToday(context: IOfferContext): number {
  return context.eventsToday.filter((event) => MEET_EVENT_TYPES.has(event.type)).length;
}

function lightMix(context: IOfferContext, candidates: ICandidate[]): ICandidate[] {
  const others = candidates.filter((candidate) => candidate.quest.type !== 'chat');
  const otherTypes = new Set(others.map((candidate) => candidate.quest.type));

  if (meetsToday(context) >= 1 || otherTypes.size < 2) {
    return others;
  }

  const chat = candidates.find((candidate) => candidate.quest.type === 'chat');

  return chat ? [...others, { ...chat, priority: LAST_PRIORITY }] : others;
}

function lotsMix(candidates: ICandidate[]): ICandidate[] {
  const chats = candidates.filter((candidate) => candidate.quest.type === 'chat');

  if (chats.length < 2) {
    return candidates;
  }

  const others = candidates.filter((candidate) => candidate.quest.type !== 'chat').sort((left, right) => left.priority - right.priority);
  const keepTypes = new Set<QuestType>(['boss']);
  const best = others.find((candidate) => candidate.quest.type !== 'boss');

  if (best) {
    keepTypes.add(best.quest.type);
  }

  return [...chats.map((candidate) => ({ ...candidate, priority: Math.min(candidate.priority, 0.5) })), ...others.filter((candidate) => keepTypes.has(candidate.quest.type))];
}

function socialMixFor(intent: IAttendeeIntent): 'light' | 'some' | 'lots' {
  return intent.goals.includes('booth') && intent.socialLevel === 'some' ? 'lots' : intent.socialLevel;
}

export function shapeForIntent(context: IOfferContext, candidates: ICandidate[]): ICandidate[] {
  const intent = context.attendee.intent;

  if (!intent) {
    return candidates;
  }

  let shaped = shifted(candidates, intent.goals);

  if (intent.goals.includes('booth')) {
    shaped = capType(shaped, 'outpost', 1);
  }

  const mix = socialMixFor(intent);

  if (mix === 'light') {
    return lightMix(context, shaped);
  }

  return mix === 'lots' ? lotsMix(shaped) : shaped;
}
