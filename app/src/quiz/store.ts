import { generateQuiz, isQuestionList, normalizeQuestions, quizLength } from '../ai/quiz';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { ToolError } from '../tools/tool-errors';
import { quizSources } from '../types/kubequest.constants';
import { IQuizAnswerResult, IQuizQuestionWithAnswer, IQuizResult, IStoredQuiz, ITalk, IXpEvent } from '../types/kubequest.interfaces';
import { QuizSource } from '../types/kubequest.types';
import { claimOnce } from '../xp/award';

interface ITalkDoc extends ITalk {
  quiz?: unknown;
  bossQuiz?: unknown;
}

const MAX_CHUNKS = 6;

export async function loadTalk(talkId: string): Promise<ITalkDoc> {
  try {
    const response = await getEsClient().get<ITalkDoc>(
      { index: indexNames.TALKS, id: talkId, _source_excludes: ['transcript', 'searchText'] },
      esOptions(esTimeouts.DEFAULT_MS),
    );

    if (!response._source) {
      throw new ToolError(404, 'talk_not_found', 'That talk is not on the schedule.');
    }

    return { ...response._source, id: response._source.id ?? talkId };
  } catch (error) {
    if (error instanceof ToolError) {
      throw error;
    }

    const status: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'statusCode') : undefined;

    if (status === 404) {
      throw new ToolError(404, 'talk_not_found', 'That talk is not on the schedule.');
    }

    throw error;
  }
}

function readStoredQuiz(talk: ITalkDoc): IStoredQuiz | undefined {
  const raw = talk.isBoss && talk.bossQuiz ? talk.bossQuiz : talk.quiz;
  const count = quizLength(talk);

  if (Array.isArray(raw)) {
    return isQuestionList(raw, count)
      ? { talkId: talk.id, source: 'abstract', generatedBy: 'fallback', questions: normalizeQuestions(talk.id, raw), createdAt: new Date().toISOString() }
      : undefined;
  }

  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }

  const questions: unknown = Reflect.get(raw, 'questions');

  if (!Array.isArray(questions) || questions.length < 1 || !isQuestionList(questions, questions.length)) {
    return undefined;
  }

  const source: unknown = Reflect.get(raw, 'source');
  const generatedBy: unknown = Reflect.get(raw, 'generatedBy');
  const createdAt: unknown = Reflect.get(raw, 'createdAt');

  return {
    talkId: talk.id,
    source: quizSources.find((value) => value === source) ?? 'abstract',
    generatedBy: generatedBy === 'agent_builder' || generatedBy === 'inference' ? generatedBy : 'fallback',
    questions: normalizeQuestions(talk.id, questions),
    createdAt: typeof createdAt === 'string' ? createdAt : new Date().toISOString(),
  };
}

async function transcriptChunks(talk: ITalk): Promise<string> {
  if (!talk.hasTranscript) {
    return '';
  }

  try {
    const response = await getEsClient().search(
      {
        index: indexNames.TALKS,
        size: 1,
        _source: false,
        query: {
          bool: {
            filter: [{ term: { id: talk.id } }],
            must: [{ semantic: { field: 'transcript', query: `${talk.title}. ${talk.abstract}` } }],
          },
        },
        highlight: { fields: { transcript: { type: 'semantic', number_of_fragments: MAX_CHUNKS, order: 'score' } } },
      },
      esOptions(esTimeouts.SEARCH_MS),
    );

    return (response.hits.hits[0]?.highlight?.['transcript'] ?? []).join('\n');
  } catch (error) {
    logger.warn({ err: error, talkId: talk.id }, 'transcript chunk lookup failed, using the abstract');

    return '';
  }
}

async function cacheQuiz(stored: IStoredQuiz): Promise<void> {
  try {
    await getEsClient().update({ index: indexNames.TALKS, id: stored.talkId, doc: { quiz: stored } }, esOptions(esTimeouts.WRITE_MS));
  } catch (error) {
    logger.warn({ err: error, talkId: stored.talkId }, 'could not cache the quiz on the talk');
  }
}

export async function quizForTalk(talk: ITalkDoc): Promise<IStoredQuiz> {
  const stored = readStoredQuiz(talk);

  if (stored) {
    return stored;
  }

  const chunks = await transcriptChunks(talk);
  const source: QuizSource = chunks !== '' ? 'transcript' : 'abstract';
  const generated = await generateQuiz(talk, chunks !== '' ? chunks : talk.abstract);
  const quiz: IStoredQuiz = {
    talkId: talk.id,
    source,
    generatedBy: generated.provider,
    questions: generated.value,
    createdAt: new Date().toISOString(),
  };

  await cacheQuiz(quiz);

  return quiz;
}

export async function findQuizEvent(attendeeId: string, talkId: string): Promise<IXpEvent | undefined> {
  const response = await getEsClient().search<IXpEvent>(
    {
      index: indexNames.XP_EVENTS,
      size: 1,
      query: { bool: { filter: [{ term: { attendeeId } }, { term: { talkId } }, { term: { type: 'quiz' } }] } },
      sort: [{ xp: { order: 'desc' } }, { at: { order: 'asc' } }],
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.hits.hits[0]?._source;
}

export function quizClaimId(attendeeId: string, talkId: string): string {
  return `${attendeeId}:quiz:${talkId}`;
}

export async function claimQuiz(attendeeId: string, talkId: string, correct: number): Promise<boolean> {
  const claim: IXpEvent = { id: quizClaimId(attendeeId, talkId), attendeeId, type: 'quiz', xp: 0, talkId, correct, at: new Date().toISOString() };

  return claimOnce(claim);
}

export function gradeAnswers(questions: IQuizQuestionWithAnswer[], answers: number[]): IQuizAnswerResult[] {
  return questions.map((question, index) => {
    const chosenIndex = answers[index] ?? -1;

    return {
      questionId: question.id,
      chosenIndex,
      correctIndex: question.answerIndex,
      correct: chosenIndex === question.answerIndex,
      explanation: question.explanation,
    };
  });
}

export function previousResult(quiz: IStoredQuiz, event: IXpEvent): IQuizResult {
  return {
    talkId: quiz.talkId,
    correct: event.correct ?? 0,
    total: quiz.questions.length,
    xpAwarded: event.xp,
    alreadySubmitted: true,
    results: gradeAnswers(quiz.questions, []),
  };
}
