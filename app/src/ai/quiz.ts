import { IAiResult } from '../types/internal.interfaces';
import { gameRules, tracks } from '../types/kubequest.constants';
import { IQuizQuestionWithAnswer, ITalk } from '../types/kubequest.interfaces';
import { generateJson } from './client';

const CHOICES_PER_QUESTION = 4;
const MAX_CONTEXT_CHARS = 6000;

export function quizLength(talk: ITalk): number {
  return talk.isBoss ? gameRules.BOSS_QUESTIONS : gameRules.QUIZ_QUESTIONS;
}

function isQuestion(value: unknown): value is IQuizQuestionWithAnswer {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prompt: unknown = Reflect.get(value, 'prompt');
  const choices: unknown = Reflect.get(value, 'choices');
  const answerIndex: unknown = Reflect.get(value, 'answerIndex');
  const explanation: unknown = Reflect.get(value, 'explanation');

  return (
    typeof prompt === 'string' &&
    prompt.trim() !== '' &&
    Array.isArray(choices) &&
    choices.length === CHOICES_PER_QUESTION &&
    choices.every((choice) => typeof choice === 'string' && choice.trim() !== '') &&
    new Set(choices).size === CHOICES_PER_QUESTION &&
    typeof answerIndex === 'number' &&
    Number.isInteger(answerIndex) &&
    answerIndex >= 0 &&
    answerIndex < CHOICES_PER_QUESTION &&
    (explanation === undefined || typeof explanation === 'string')
  );
}

export function isQuestionList(value: unknown, count: number): value is IQuizQuestionWithAnswer[] {
  return Array.isArray(value) && value.length === count && value.every(isQuestion);
}

export function normalizeQuestions(talkId: string, questions: IQuizQuestionWithAnswer[]): IQuizQuestionWithAnswer[] {
  return questions.map((question, index) => ({
    id: question.id && question.id.trim() !== '' ? question.id : `${talkId}-q${index + 1}`,
    prompt: question.prompt.trim(),
    choices: question.choices.map((choice) => choice.trim()),
    answerIndex: question.answerIndex,
    explanation: question.explanation,
  }));
}

function rotate<T>(items: T[], correct: T, seed: number): { choices: T[]; answerIndex: number } {
  const others = items.filter((item) => item !== correct).slice(0, CHOICES_PER_QUESTION - 1);
  const answerIndex = seed % CHOICES_PER_QUESTION;
  const choices = [...others];
  choices.splice(answerIndex, 0, correct);

  return { choices, answerIndex };
}

function seedOf(text: string): number {
  return [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7);
}

function padChoices(base: string[], extras: string[]): string[] {
  const unique = [...new Set(base)];

  for (const extra of extras) {
    if (unique.length >= CHOICES_PER_QUESTION) {
      break;
    }

    if (!unique.includes(extra)) {
      unique.push(extra);
    }
  }

  return unique;
}

function fallbackQuiz(talk: ITalk, count: number): IQuizQuestionWithAnswer[] {
  const seed = seedOf(talk.id);
  const speaker = talk.speakers[0] ?? 'The CNCF program committee';
  const trackChoices = rotate([...tracks].filter((track) => track !== talk.track), talk.track, seed);
  const speakerChoices = rotate(padChoices([speaker], ['Kelsey Hightower', 'Liz Rice', 'Brendan Burns', 'Kat Cosgrove', 'Tim Hockin']), speaker, seed + 1);
  const roomChoices = rotate(padChoices([talk.room], ['Hall A', 'Ballroom B', 'Room 151', 'Room 250', 'Expo Stage']), talk.room, seed + 2);
  const words = talk.abstract.split(/\s+/).filter((word) => word.length > 6).map((word) => word.replace(/[^A-Za-z0-9-]/g, ''));
  const keyword = words[0] ?? talk.title.split(/\s+/)[0] ?? 'Kubernetes';
  const keywordChoices = rotate(padChoices([keyword], ['Mainframes', 'Spreadsheets', 'Fax machines', 'Floppy disks']), keyword, seed + 3);
  const formatChoices = rotate(padChoices([talk.sessionType], ['keynote', 'breakout', 'lightning', 'tutorial', 'panel']), talk.sessionType, seed + 4);

  const questions: IQuizQuestionWithAnswer[] = [
    { id: '', prompt: `Which track does "${talk.title}" belong to?`, ...trackChoices, explanation: `It is in the ${talk.track} track.` },
    { id: '', prompt: `Who presented "${talk.title}"?`, ...speakerChoices, explanation: `${speaker} gave this talk.` },
    { id: '', prompt: 'Which of these does the talk abstract mention?', ...keywordChoices, explanation: `The abstract mentions ${keyword}.` },
    { id: '', prompt: 'Where did this session take place?', ...roomChoices, explanation: `It was in ${talk.room}.` },
    { id: '', prompt: 'What kind of session was this?', ...formatChoices, explanation: `It was a ${talk.sessionType}.` },
  ];

  return normalizeQuestions(talk.id, questions.slice(0, count));
}

function buildPrompt(talk: ITalk, count: number, context: string): string {
  return [
    `Write a ${count}-question multiple-choice quiz that checks whether someone listened to this KubeCon talk.`,
    `Each question has exactly ${CHOICES_PER_QUESTION} distinct choices and one correct answer.`,
    'Ask about ideas from the talk, not trivia about the speaker. Keep each question under 140 characters.',
    'Return only JSON: an array of objects {"prompt": string, "choices": string[4], "answerIndex": 0-3, "explanation": string}.',
    `Title: ${talk.title}`,
    `Speakers: ${talk.speakers.join(', ')}`,
    `Material: ${context.slice(0, MAX_CONTEXT_CHARS)}`,
  ].join('\n');
}

export async function generateQuiz(talk: ITalk, context?: string): Promise<IAiResult<IQuizQuestionWithAnswer[]>> {
  const count = quizLength(talk);
  const material = context && context.trim() !== '' ? context : talk.abstract;
  const result = await generateJson('quiz', buildPrompt(talk, count, material), (value): value is IQuizQuestionWithAnswer[] => isQuestionList(value, count), () => fallbackQuiz(talk, count));

  if (!isQuestionList(result.value, count)) {
    return { ...result, value: fallbackQuiz(talk, count), provider: 'fallback' };
  }

  return { ...result, value: normalizeQuestions(talk.id, result.value) };
}
