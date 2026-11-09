import { randomUUID } from 'node:crypto';
import type { IQuiz, IQuizForTalkInput, ISubmitQuizInput, ISubmitQuizOutput, IXpEvent } from '@kubequest/shared';
import { ResourceStoreService } from '../resources/resource-store.service';
import { LookupService } from './lookup.service';
import { QuizHelper } from './quiz.helper';
import { xpRewards } from './tools.constants';
import { ToolInputError } from './tools.errors';
import { XpLedgerService } from './xp-ledger.service';

export class QuizService {
  private readonly _store: ResourceStoreService;
  private readonly _lookup: LookupService;
  private readonly _ledger: XpLedgerService;

  public constructor(store: ResourceStoreService, lookup: LookupService, ledger: XpLedgerService) {
    this._store = store;
    this._lookup = lookup;
    this._ledger = ledger;
  }

  public async quizForTalk(input: IQuizForTalkInput): Promise<IQuiz> {
    const session = this._lookup.session(input.talkId);

    return QuizHelper.buildQuiz(session, this._store.getSessions(), this._store.getLocations());
  }

  public async submitQuiz(input: ISubmitQuizInput): Promise<ISubmitQuizOutput> {
    const attendee = this._lookup.attendee(input.attendeeId);
    const quiz = await this.quizForTalk({ talkId: input.talkId });

    if (input.answers.length !== quiz.questions.length) {
      throw new ToolInputError(`Please answer all ${quiz.questions.length} questions.`);
    }

    const correct = QuizHelper.scoreAnswers(quiz, input.answers);
    const alreadySubmitted = this._store
      .getXpEvents()
      .some((event) => event.type === 'quiz' && event.attendeeId === attendee.id && event.talkId === input.talkId);
    const xp = alreadySubmitted ? 0 : correct * xpRewards.QUIZ_CORRECT_ANSWER;

    if (!alreadySubmitted) {
      const event: IXpEvent = {
        id: `xp-${randomUUID()}`,
        attendeeId: attendee.id,
        type: 'quiz',
        xp,
        talkId: quiz.talkId,
        at: this._store.now().toISOString(),
      };

      await this._ledger.record(event);
    }

    return { correct, xp };
  }
}
