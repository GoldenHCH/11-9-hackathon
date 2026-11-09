import type { IIntro, ILocation, IQuiz, ISession, IXpEvent } from './conference.interfaces';
import type { HealthStatus, IndexName, IntroResponse } from './conference.types';
import type { IPersonMatch, ITalkMatch } from './matches.interfaces';
import type { ToolName } from './tools.types';

export interface ICheckInInput {
  attendeeId: string;
  locationId: string;
  token?: string;
}

export interface ICheckInOutput {
  location: ILocation;
  xp: number;
  event: IXpEvent;
}

export interface IRecommendTalksInput {
  attendeeId: string;
  day?: string;
  limit?: number;
}

export interface IRecommendPeopleInput {
  attendeeId: string;
  hereOnly?: boolean;
  limit?: number;
}

export interface IWhatsAroundMeInput {
  attendeeId: string;
}

export interface IWhatsAroundMeOutput {
  location: ILocation | null;
  sessionsNowHere: ISession[];
  sessionsNextHere: ISession[];
  peopleHere: IPersonMatch[];
}

export interface IWhatsNextInput {
  attendeeId: string;
}

export interface IWhatsNextOutput {
  session: ISession | null;
  startsInMinutes: number | null;
  walkMinutes: number | null;
}

export interface IProposeIntroInput {
  fromId: string;
  toId: string;
}

export interface IRespondIntroInput {
  introId: string;
  attendeeId: string;
  response: IntroResponse;
}

export interface IQuizForTalkInput {
  talkId: string;
}

export interface ISubmitQuizInput {
  attendeeId: string;
  talkId: string;
  answers: number[];
}

export interface ISubmitQuizOutput {
  correct: number;
  xp: number;
}

export interface ILeaderboardInput {
  limit?: number;
}

export interface ILeaderboardEntry {
  handle: string;
  xp: number;
  badges: string[];
}

export interface IToolSignatures {
  check_in: { input: ICheckInInput; output: ICheckInOutput };
  recommend_talks: { input: IRecommendTalksInput; output: ITalkMatch[] };
  recommend_people: { input: IRecommendPeopleInput; output: IPersonMatch[] };
  whats_around_me: { input: IWhatsAroundMeInput; output: IWhatsAroundMeOutput };
  whats_next: { input: IWhatsNextInput; output: IWhatsNextOutput };
  propose_intro: { input: IProposeIntroInput; output: IIntro };
  respond_intro: { input: IRespondIntroInput; output: IIntro };
  quiz_for_talk: { input: IQuizForTalkInput; output: IQuiz };
  submit_quiz: { input: ISubmitQuizInput; output: ISubmitQuizOutput };
  leaderboard: { input: ILeaderboardInput; output: ILeaderboardEntry[] };
}

export interface IToolDescription {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface IToolErrorResponse {
  error: string;
}

export interface IHealthElasticsearch {
  configured: boolean;
  reachable: boolean;
  inferenceId: string;
  counts: Partial<Record<IndexName, number>>;
}

export interface IHealthResponse {
  status: HealthStatus;
  version: string;
  elasticsearch: IHealthElasticsearch;
}
