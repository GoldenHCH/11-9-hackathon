import type { IIntro, ISession, IXpEvent, Seniority, TalkTrack } from '../../shared/src/index';

export interface IParsedLocation {
  venue: string;
  floor: string;
  room: string;
}

export interface ITrackRule {
  track: TalkTrack;
  patterns: RegExp[];
}

export interface IRoomSource {
  locationId: string;
  name: string;
  venue: string;
  floor: string;
}

export interface IKickoffTalk {
  id: string;
  title: string;
  abstract: string;
  speakers: string[];
  startLocal: string;
  endLocal: string;
  track: TalkTrack;
}

export interface IScheduleEventPerformer {
  name?: string;
}

export interface IScheduleEvent {
  name?: string;
  startDate?: string;
  endDate?: string;
  url?: string;
  description?: string;
  location?: { name?: string };
  performer?: IScheduleEventPerformer[] | IScheduleEventPerformer;
  subEvent?: IScheduleEvent[];
}

export interface IVenueLayout {
  eastMeters: number;
  northMeters: number;
  spreadMeters: number;
}

export interface IFixedLocation {
  id: string;
  name: string;
  kind: 'meeting-point' | 'booth';
  venue: string;
  floor: string;
  eastMeters: number;
  northMeters: number;
}

export interface ITopicProfile {
  keyword: string;
  track: TalkTrack;
  related: string[];
  roles: string[];
  works: string[];
  struggles: string[];
  offers: string[];
  asks: string[];
  alsoPhrase: string;
  icebreaker: string;
}

export interface ICultureNames {
  culture: string;
  nativeLanguage?: string;
  givenNames: string[];
  familyNames: string[];
}

export interface IPersonaSpec {
  id: string;
  handle: string;
  name: string;
  headline: string;
  profileText: string;
  topics: string[];
  seniority: Seniority;
  goals: string[];
  offers: string[];
  asks: string[];
  languages: string[];
  firstTimer: boolean;
  welcomer: boolean;
  createdAt: string;
}

export interface ICheckInPick {
  session: ISession;
  at: string;
}

export interface IBadgeInput {
  attendeeId: string;
  firstTimer: boolean;
  checkIns: { track: TalkTrack; at: string }[];
  handshakes: { at: string; counterpartFirstTimer: boolean }[];
}

export interface IEarnedBadge {
  name: string;
  earnedAt: string;
}

export interface IScoredMatch {
  attendeeId: string;
  score: number;
  sharedTopics: string[];
}

export interface IPlanOptions {
  count: number;
  recent: boolean;
  forcedLatest?: { session: ISession; atMs: number };
  observabilityOnly?: boolean;
}

export interface IBusyInterval {
  startMs: number;
  endMs: number;
}

export interface IIntroBuildResult {
  intros: IIntro[];
  handshakeEvents: IXpEvent[];
}
