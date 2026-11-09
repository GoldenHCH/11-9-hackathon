import type { ISession } from './conference.interfaces';

export interface IPublicAttendee {
  id: string;
  handle: string;
  name: string;
  headline: string;
  avatarUrl?: string;
  firstTimer: boolean;
  welcomer: boolean;
  xp: number;
  badges: string[];
}

export interface IPersonMatch {
  attendee: IPublicAttendee;
  score: number;
  reasons: string[];
  sharedTopics: string[];
  isHere: boolean;
  locationId?: string;
  distanceMeters?: number;
}

export interface ITalkMatch {
  session: ISession;
  score: number;
  reasons: string[];
  startsInMinutes: number;
  walkMinutes?: number;
}
