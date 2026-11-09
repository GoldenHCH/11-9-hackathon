import type {
  IntroStatus,
  LocationKind,
  QuizSource,
  Seniority,
  TalkLevel,
  TalkTrack,
  XpEventType,
} from './conference.types';

export interface IGeoPoint {
  lat: number;
  lon: number;
}

export interface ITimeSlot {
  start: string;
  end: string;
}

export interface ISession {
  id: string;
  title: string;
  abstract: string;
  speakers: string[];
  start: string;
  end: string;
  venue: string;
  level: TalkLevel;
  track: TalkTrack;
  locationId: string;
  url: string;
  hasTranscript: boolean;
}

export interface ILocation {
  id: string;
  name: string;
  kind: LocationKind;
  venue: string;
  floor: string;
  geo: IGeoPoint;
  token?: string;
}

export interface IProfile {
  topics: string[];
  seniority: Seniority;
  goals: string[];
  offers: string[];
  asks: string[];
  languages: string[];
  firstTimer: boolean;
  welcomer: boolean;
}

export interface IAttendee {
  id: string;
  handle: string;
  name: string;
  githubLogin?: string;
  avatarUrl?: string;
  headline: string;
  profileText: string;
  profile: IProfile;
  lastLocation?: IGeoPoint;
  lastLocationId?: string;
  lastSeenAt?: string;
  visible: boolean;
  xp: number;
  badges: string[];
  createdAt: string;
}

export interface IXpEvent {
  id: string;
  attendeeId: string;
  type: XpEventType;
  xp: number;
  talkId?: string;
  locationId?: string;
  introId?: string;
  at: string;
}

export interface IIntroArrival {
  attendeeId: string;
  at: string;
}

export interface IIntro {
  id: string;
  fromId: string;
  toId: string;
  status: IntroStatus;
  proposedAt: string;
  slot?: ITimeSlot;
  meetingPointId?: string;
  icebreaker?: string;
  arrivals: IIntroArrival[];
}

export interface IQuizQuestion {
  q: string;
  choices: string[];
  answer: number;
}

export interface IQuiz {
  talkId: string;
  questions: IQuizQuestion[];
  source: QuizSource;
}

export interface IDemoPersonas {
  platformEngineerId: string;
  firstTimerId: string;
}

export interface ISeedMeta {
  seedNow: string;
  demoPersonas: IDemoPersonas;
}
