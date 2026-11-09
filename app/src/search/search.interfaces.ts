import { IsoDateString, SessionType, Track } from '../types/kubequest.types';
import { AskResultKind, SummarySource } from './search.types';

export interface IAskFilters {
  kinds?: AskResultKind[];
  track?: Track;
}

export interface IAskInput {
  query: string;
  attendeeId?: string;
  filters?: IAskFilters;
}

export interface IAskTalk {
  resultId: string;
  id: string;
  title: string;
  track: Track;
  sessionType: SessionType;
  speakers: string[];
  start: IsoDateString;
  end: IsoDateString;
  room: string;
  building: string;
  level: string;
  locationId: string;
  snippet: string;
  highlight?: string;
  snippetSource: 'summary' | 'transcript' | 'abstract';
  summarySource?: SummarySource;
  inItinerary?: boolean;
  quizAvailable: boolean;
  isBoss: boolean;
}

export interface IAskPerson {
  resultId: string;
  publicId: string;
  handle: string;
  faceSeed: string;
  headline: string;
  topics: string[];
  sharedTopics: string[];
  why: string;
  isSpeaker: boolean;
}

export interface IAskBooth {
  resultId: string;
  locationId: string;
  name: string;
  boothNumber?: string;
  sponsorTier?: string;
  askAbout?: string;
  building: string;
  level: string;
  zone?: string;
}

export interface IAskResult {
  query: string;
  mode: 'hybrid' | 'lexical';
  tookMs: number;
  talks: IAskTalk[];
  people: IAskPerson[];
  booths: IAskBooth[];
  topIds: string[];
}

export interface IAskAnswerInput {
  query: string;
  resultIds: string[];
}

export interface IAskCitation {
  n: number;
  resultId: string;
  kind: AskResultKind;
  title: string;
}

export interface IAskAnswer {
  query: string;
  answer: string;
  citations: IAskCitation[];
  provider: 'agent_builder' | 'fallback';
  pending: boolean;
}

export interface ISearchToolContracts {
  ask: { input: IAskInput; output: IAskResult };
  ask_answer: { input: IAskAnswerInput; output: IAskAnswer };
}
