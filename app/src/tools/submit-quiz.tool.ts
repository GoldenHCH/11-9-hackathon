import { z } from 'zod';
import { kubequestMetrics } from '../observability/metrics';
import { logger } from '../observability/logger';
import { BossDamageSkip, recordBossAnswers } from '../quests/boss';
import { loadAttendee } from '../quests/store';
import { claimQuiz, findQuizEvent, gradeAnswers, loadTalk, quizForTalk } from '../quiz/store';
import { gameRules, xpRewards } from '../types/kubequest.constants';
import { IBossState, IQuizResult } from '../types/kubequest.interfaces';
import { awardXp } from '../xp/award';
import { defineTool } from './define-tool';
import { isToolError } from './tool-errors';
import { attendeeIdSchema, idSchema, isoDateSchema } from './tool-schemas';

interface ISubmitQuizResult extends IQuizResult {
  bossDamageCounted?: boolean;
  bossDamageSkipped?: BossDamageSkip;
  bossMessage?: string;
}

function recordDuration(startedAt: string | undefined, isBoss: boolean): void {
  if (!startedAt) {
    return;
  }

  const seconds = (Date.now() - Date.parse(startedAt)) / 1000;

  if (Number.isFinite(seconds) && seconds >= 0) {
    kubequestMetrics().quizDuration.record(seconds, { 'kubequest.quiz.boss': isBoss });
  }
}

function softFail(error: unknown, what: string): void {
  if (isToolError(error) && error.status === 501) {
    logger.warn({ what }, 'dependency not built yet');

    return;
  }

  throw error;
}

export const submitQuizTool = defineTool({
  name: 'submit_quiz',
  description:
    'Grade quiz answers in code: 5 XP per correct answer, once per talk. In a boss room, correct answers also damage the boss, but only for a player who checked in to that room during the fight (session start to end + 15 min); otherwise bossDamageCounted is false and bossDamageSkipped says why.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    talkId: idSchema,
    answers: z.array(z.number().int().min(0).max(9)).min(1).max(gameRules.BOSS_QUESTIONS),
    startedAt: isoDateSchema.optional(),
  }),
  xpAwarded: (output) => output.xpAwarded,
  run: async ({ attendeeId, talkId, answers, startedAt }): Promise<ISubmitQuizResult> => {
    await loadAttendee(attendeeId);
    const talk = await loadTalk(talkId);
    const quiz = await quizForTalk(talk);
    const results = gradeAnswers(quiz.questions, answers);
    const correct = results.filter((result) => result.correct).length;
    const existing = await findQuizEvent(attendeeId, talk.id);
    const alreadySubmitted = {
      talkId: talk.id,
      correct: existing?.correct ?? correct,
      total: quiz.questions.length,
      xpAwarded: 0,
      alreadySubmitted: true,
      results,
    };

    if (existing || !(await claimQuiz(attendeeId, talk.id, correct))) {
      return alreadySubmitted;
    }

    recordDuration(startedAt, talk.isBoss);

    let xpAwarded = 0;

    try {
      const event = await awardXp({ attendeeId, type: 'quiz', xp: correct * xpRewards.QUIZ_CORRECT_ANSWER, talkId: talk.id, correct });
      xpAwarded = event.xp;
    } catch (error) {
      softFail(error, 'awardXp');
    }

    const result: ISubmitQuizResult = { talkId: talk.id, correct, total: quiz.questions.length, xpAwarded, alreadySubmitted: false, results };

    if (talk.isBoss) {
      try {
        const outcome = await recordBossAnswers(attendeeId, talk.id, correct);

        if (outcome) {
          const boss: IBossState = outcome.state;
          result.boss = boss;
          result.bossDamageCounted = outcome.damageCounted;
          result.bossMessage = outcome.message;

          if (outcome.damageSkipped) {
            result.bossDamageSkipped = outcome.damageSkipped;
          }
        }
      } catch (error) {
        softFail(error, 'recordBossAnswers');
      }
    }

    return result;
  },
});
