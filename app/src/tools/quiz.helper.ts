import type { ILocation, IQuiz, IQuizQuestion, ISession, TalkTrack } from '@kubequest/shared';
import { MatchingHelper } from './matching.helper';
import type { IArrangedChoices } from './quiz.interfaces';
import { fallbackAbstractWords, fallbackRoomNames, levelLabels, toolDefaults } from './tools.constants';

export class QuizHelper {
  public static buildQuiz(session: ISession, sessions: ISession[], locations: ILocation[]): IQuiz {
    const questions = [
      QuizHelper._trackQuestion(session),
      QuizHelper._abstractWordQuestion(session, sessions),
      QuizHelper._roomQuestion(session, sessions, locations),
    ];

    return { talkId: session.id, questions: questions.slice(0, toolDefaults.QUIZ_QUESTIONS), source: 'abstract' };
  }

  public static scoreAnswers(quiz: IQuiz, answers: number[]): number {
    return quiz.questions.filter((question, position) => answers[position] === question.answer).length;
  }

  private static _trackQuestion(session: ISession): IQuizQuestion {
    const allTracks: TalkTrack[] = ['ai', 'security', 'networking', 'observability', 'platform', 'storage', 'other'];
    const correct = QuizHelper._trackLabel(session.track);
    const distractors = allTracks.filter((track) => track !== session.track).map((track) => QuizHelper._trackLabel(track));
    const arranged = QuizHelper._arrange(correct, distractors, `${session.id}:track`);

    return { q: `Which track is the talk "${session.title}" part of?`, ...arranged };
  }

  private static _abstractWordQuestion(session: ISession, sessions: ISession[]): IQuizQuestion {
    const ownWords = MatchingHelper.words(`${session.abstract} ${session.title}`).filter((word) => word.length >= 6);

    if (ownWords.length === 0) {
      const levelAnswer = levelLabels[session.level - 1];
      const arranged = QuizHelper._arrange(
        levelAnswer,
        levelLabels.filter((label) => label !== levelAnswer),
        `${session.id}:level`,
      );

      return { q: `Which audience is "${session.title}" aimed at?`, ...arranged };
    }

    const frequency = new Map<string, number>();

    for (const word of ownWords) {
      frequency.set(word, (frequency.get(word) ?? 0) + 1);
    }

    const keyword = [...frequency.entries()].sort(
      (left, right) => right[1] - left[1] || right[0].length - left[0].length || left[0].localeCompare(right[0]),
    )[0][0];
    const ownWordSet = new Set(ownWords);
    const otherWords = sessions
      .filter((other) => other.id !== session.id)
      .flatMap((other) => MatchingHelper.words(other.abstract))
      .filter((word) => word.length >= 6 && !ownWordSet.has(word));
    const distractors = QuizHelper._padWith([...new Set(otherWords)], fallbackAbstractWords, keyword);
    const arranged = QuizHelper._arrange(keyword, distractors, `${session.id}:word`);

    return { q: `Which of these words comes up in the description of "${session.title}"?`, ...arranged };
  }

  private static _roomQuestion(session: ISession, sessions: ISession[], locations: ILocation[]): IQuizQuestion {
    const location = locations.find((entry) => entry.id === session.locationId);
    const correct = location?.name ?? session.venue;
    const roomNames = locations.filter((entry) => entry.kind === 'room').map((entry) => entry.name);
    const venueNames = sessions.map((entry) => entry.venue);
    const distractors = QuizHelper._padWith(
      [...new Set([...roomNames, ...venueNames])].filter((name) => name !== correct),
      fallbackRoomNames,
      correct,
    );
    const arranged = QuizHelper._arrange(correct, distractors, `${session.id}:room`);

    return { q: `Where is "${session.title}" being held?`, ...arranged };
  }

  private static _padWith(candidates: string[], fallback: readonly string[], correct: string): string[] {
    const pool = candidates.filter((candidate) => candidate !== correct);

    for (const entry of fallback) {
      if (pool.length >= toolDefaults.QUIZ_CHOICES - 1) {
        break;
      }

      if (entry !== correct && !pool.includes(entry)) {
        pool.push(entry);
      }
    }

    return pool;
  }

  private static _arrange(correct: string, distractors: string[], seedKey: string): IArrangedChoices {
    const chosen = [...new Set(distractors)]
      .sort((left, right) => QuizHelper._hash(`${seedKey}:${left}`) - QuizHelper._hash(`${seedKey}:${right}`))
      .slice(0, toolDefaults.QUIZ_CHOICES - 1);
    const answer = QuizHelper._hash(seedKey) % (chosen.length + 1);
    const choices = [...chosen.slice(0, answer), correct, ...chosen.slice(answer)];

    return { choices, answer };
  }

  private static _trackLabel(track: TalkTrack): string {
    return track === 'ai' ? 'AI' : `${track.charAt(0).toUpperCase()}${track.slice(1)}`;
  }

  private static _hash(text: string): number {
    let hash = 2166136261;

    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }

    return hash;
  }
}
