import { z } from 'zod';
import { logger } from '../observability/logger';
import { findQuizEvent, loadTalk, previousResult, quizForTalk } from '../quiz/store';
import { IQuizResult } from '../types/kubequest.interfaces';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const quizForTalkTool = defineTool({
  name: 'quiz_for_talk',
  description:
    'The quiz for a talk without the answers: 3 questions (5 for a boss), from the transcript or the abstract, plus the previous result if the player already submitted.',
  input: z.object({
    talkId: idSchema,
    attendeeId: attendeeIdSchema.optional(),
  }),
  run: async ({ talkId, attendeeId }) => {
    const talk = await loadTalk(talkId);
    const quiz = await quizForTalk(talk);
    let previous: IQuizResult | undefined;

    if (attendeeId) {
      try {
        const event = await findQuizEvent(attendeeId, talk.id);
        previous = event ? previousResult(quiz, event) : undefined;
      } catch (error) {
        logger.warn({ err: error, talkId }, 'could not look up the previous quiz result');
      }
    }

    return {
      talkId: talk.id,
      talkTitle: talk.title,
      source: quiz.source,
      isBoss: talk.isBoss,
      questions: quiz.questions.map(({ id, prompt, choices }) => ({ id, prompt, choices })),
      previousResult: previous,
    };
  },
});
