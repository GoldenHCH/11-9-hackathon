import { z } from 'zod';
import { logger } from '../observability/logger';
import { generateJson, sanitizeForPrompt } from './client';
import { handshakeAiSettings, handshakeQuestionTemplate } from './prompts.constants';

const questionSchema = z.object({ question: z.string().min(12).max(160) });

type IPhrasedQuestion = z.infer<typeof questionSchema>;

function withTimeout<T>(work: Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(fallback), timeoutMs);

    work
      .then((value) => resolve(value))
      .catch((error: unknown) => {
        logger.warn({ err: error }, 'handshake question phrasing failed, using template');
        resolve(fallback);
      })
      .finally(() => clearTimeout(timer));
  });
}

export async function phraseHandshakeQuestion(handle: string, templateQuestion: string): Promise<string> {
  const handlePrefix = `ask @${handle.toLowerCase()}`;
  const validate = (value: unknown): value is IPhrasedQuestion => {
    const parsed = questionSchema.safeParse(value);

    return parsed.success && parsed.data.question.toLowerCase().startsWith(handlePrefix) && parsed.data.question.trim().endsWith('?');
  };
  const prompt = [handshakeQuestionTemplate.replaceAll('{handleB}', handle), '<data>', sanitizeForPrompt(templateQuestion, 200), '</data>'].join('\n');
  const work = generateJson<IPhrasedQuestion>('handshake_question', prompt, validate, () => ({ question: templateQuestion })).then(
    (result) => result.value.question,
  );

  return withTimeout(work, templateQuestion, handshakeAiSettings.TIMEOUT_MS);
}
