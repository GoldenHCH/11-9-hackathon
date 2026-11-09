import type { IAttendee } from '../../shared/src/index';
import type { IScoredMatch } from './data-scripts.interfaces';

export function scorePair(source: IAttendee, candidate: IAttendee): IScoredMatch {
  const candidateTopics = new Set(candidate.profile.topics);
  const sharedTopics = source.profile.topics.filter((topic) => candidateTopics.has(topic));
  const welcomeBonus =
    (source.profile.firstTimer && candidate.profile.welcomer) ||
    (source.profile.welcomer && candidate.profile.firstTimer)
      ? 1
      : 0;

  return { attendeeId: candidate.id, score: sharedTopics.length + welcomeBonus, sharedTopics };
}

export function topMatches(source: IAttendee, everyone: IAttendee[], limit: number): IScoredMatch[] {
  return everyone
    .filter((candidate) => candidate.id !== source.id && candidate.visible)
    .map((candidate) => scorePair(source, candidate))
    .sort((first, second) => second.score - first.score || first.attendeeId.localeCompare(second.attendeeId))
    .slice(0, limit);
}
