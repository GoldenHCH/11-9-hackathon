export interface IScoreResult {
  score: number;
  reasons: string[];
}

export interface IPersonScore extends IScoreResult {
  sharedTopics: string[];
}
