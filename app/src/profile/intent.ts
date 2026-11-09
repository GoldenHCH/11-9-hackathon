import { lightGoals, socialGoals } from '../types/intent.constants';
import { AttendeeGoal, IAttendeeIntent, IIntentInput, SocialLevel } from '../types/intent.interfaces';
import { cleanTopic } from './topics';

export function defaultSocialLevel(goals: AttendeeGoal[]): SocialLevel {
  if (goals.some((goal) => socialGoals.includes(goal))) {
    return 'lots';
  }

  if (goals.length > 0 && goals.every((goal) => lightGoals.includes(goal))) {
    return 'light';
  }

  return 'some';
}

export function normalizeIntent(input: IIntentInput): IAttendeeIntent {
  const goals = Array.from(new Set(input.goals));
  const field = goals.includes('exploring') && input.exploringField ? cleanTopic(input.exploringField) : undefined;
  return { goals, exploringField: field ?? null, socialLevel: input.socialLevel ?? defaultSocialLevel(goals) };
}
