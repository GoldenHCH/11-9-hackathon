import type { IQuizAnswerResult, IQuizResult } from '../../../../app/src/types/kubequest.interfaces';

export type {
  IBossState,
  IQuiz,
  IQuizAnswerResult,
  IQuizQuestion,
  IQuizResult,
  ISearchResponse,
  ITalk,
} from '../../../../app/src/types/kubequest.interfaces';

export type BossDamageSkip = 'not_checked_in' | 'outside_fight_window';

export interface ISubmitQuizResponse extends IQuizResult {
  bossDamageCounted?: boolean;
  bossDamageSkipped?: BossDamageSkip;
  bossMessage?: string;
}

export interface IQuestionView {
  id: string;
  prompt: string;
  choices: string[];
  result?: IQuizAnswerResult;
}
