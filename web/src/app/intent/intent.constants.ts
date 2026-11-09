import { AttendeeGoal, SocialLevel } from './intent.types';

export interface IGoalOption {
  goal: AttendeeGoal;
  label: string;
  icon: string;
}

export interface ISocialOption {
  level: SocialLevel;
  label: string;
  hint: string;
}

export const goalOptions: readonly IGoalOption[] = [
  { goal: 'exploring', label: 'Exploring a new field', icon: 'explore' },
  { goal: 'deep_dive', label: 'Going deep on a technology I use', icon: 'build' },
  { goal: 'hiring', label: 'Hiring / recruiting', icon: 'person_search' },
  { goal: 'job_seeking', label: 'Looking for a new role', icon: 'work' },
  { goal: 'booth', label: 'Representing my company at a booth', icon: 'storefront' },
  { goal: 'community', label: 'Meeting the community / giving back', icon: 'groups' },
  { goal: 'talks', label: 'Mostly here for the talks', icon: 'mic' },
  { goal: 'sent', label: 'My company sent me (just here)', icon: 'badge' },
];

export const socialOptions: readonly ISocialOption[] = [
  { level: 'light', label: 'Keep it light', hint: 'One intro a day at most' },
  { level: 'some', label: 'Some intros', hint: 'A few people who fit' },
  { level: 'lots', label: 'Introduce me to everyone', hint: 'Up to 2 of 3 quests are meets' },
];

export const lightGoals: readonly AttendeeGoal[] = ['sent', 'talks'];

export const socialGoals: readonly AttendeeGoal[] = ['hiring', 'exploring', 'community'];

export const exploringFieldLimits = { min: 2, max: 30 } as const;
