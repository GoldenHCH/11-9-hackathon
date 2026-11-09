import { lightGoals, socialGoals } from './intent.constants';
import { AttendeeGoal, IAttendeeIntent, IIntentInput, SocialLevel } from './intent.types';

export class IntentHelper {
  public static defaultSocialLevel(goals: readonly AttendeeGoal[]): SocialLevel {
    if (goals.some((goal) => socialGoals.includes(goal))) {
      return 'lots';
    }

    if (goals.length > 0 && goals.every((goal) => lightGoals.includes(goal))) {
      return 'light';
    }

    return 'some';
  }

  public static toInput(intent: IAttendeeIntent | undefined): IIntentInput {
    if (!intent) {
      return { goals: [], socialLevel: 'some' };
    }

    return { goals: [...intent.goals], socialLevel: intent.socialLevel, ...(intent.exploringField ? { exploringField: intent.exploringField } : {}) };
  }

  public static forSaving(value: IIntentInput): IIntentInput {
    const field = value.exploringField?.trim();
    const exploring = value.goals.includes('exploring') && field;

    return { goals: value.goals, socialLevel: value.socialLevel ?? IntentHelper.defaultSocialLevel(value.goals), ...(exploring ? { exploringField: field } : {}) };
  }
}
