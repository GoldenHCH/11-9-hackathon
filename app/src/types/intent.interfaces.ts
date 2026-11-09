import { attendeeGoals, socialLevels } from './intent.constants';

export type AttendeeGoal = (typeof attendeeGoals)[number];

export type SocialLevel = (typeof socialLevels)[number];

export interface IAttendeeIntent {
  goals: AttendeeGoal[];
  exploringField?: string | null;
  socialLevel: SocialLevel;
}

export interface IIntentInput {
  goals: AttendeeGoal[];
  exploringField?: string;
  socialLevel?: SocialLevel;
}
