import type { IAttendee, IProfile, IPublicAttendee, ISession } from '@kubequest/shared';
import type { IPersonScore, IScoreResult } from './matching.interfaces';
import { matchWeights, stopWords } from './tools.constants';

export class MatchingHelper {
  public static sharedTopics(left: IProfile, right: IProfile): string[] {
    const rightTopics = new Set(right.topics.map((topic) => MatchingHelper._normalise(topic)));

    return left.topics.filter((topic) => rightTopics.has(MatchingHelper._normalise(topic)));
  }

  public static scorePerson(viewer: IAttendee, candidate: IAttendee, sameLocation: boolean): IPersonScore {
    const sharedTopics = MatchingHelper.sharedTopics(viewer.profile, candidate.profile);
    const reasons = sharedTopics.slice(0, 3).map((topic) => `Both into ${topic}`);
    let score = sharedTopics.length * matchWeights.SHARED_TOPIC;

    if (viewer.profile.firstTimer && candidate.profile.welcomer) {
      score += matchWeights.WELCOMER_PAIR;
      reasons.push('A welcomer who can show you around');
    } else if (viewer.profile.welcomer && candidate.profile.firstTimer) {
      score += matchWeights.WELCOMER_PAIR;
      reasons.push('First time here, a good person to welcome');
    }

    if (sameLocation) {
      score += matchWeights.SAME_LOCATION;
      reasons.push('In the same room right now');
    }

    return { score: MatchingHelper.round(score), reasons, sharedTopics };
  }

  public static scoreTalk(profile: IProfile, session: ISession): IScoreResult {
    const title = session.title.toLowerCase();
    const abstract = session.abstract.toLowerCase();
    const track = session.track.toLowerCase();
    const titleWords = new Set(MatchingHelper.words(title));
    const abstractWords = new Set(MatchingHelper.words(abstract));
    const reasons: string[] = [];
    let score = 0;

    for (const topic of profile.topics) {
      const phrase = MatchingHelper._normalise(topic);
      let topicScore = 0;

      if (title.includes(phrase)) {
        topicScore += matchWeights.TALK_TITLE_PHRASE;
      }

      if (track.includes(phrase)) {
        topicScore += matchWeights.TALK_TRACK_PHRASE;
      }

      if (abstract.includes(phrase)) {
        topicScore += matchWeights.TALK_ABSTRACT_PHRASE;
      }

      if (topicScore === 0) {
        for (const word of MatchingHelper.words(phrase)) {
          topicScore += titleWords.has(word) ? matchWeights.TALK_TITLE_WORD : 0;
          topicScore += track === word ? matchWeights.TALK_TRACK_WORD : 0;
          topicScore += abstractWords.has(word) ? matchWeights.TALK_ABSTRACT_WORD : 0;
        }
      }

      if (topicScore > 0) {
        score += topicScore;
        reasons.push(`Matches your interest in ${topic}`);
      }
    }

    return { score: MatchingHelper.round(score), reasons: reasons.slice(0, 3) };
  }

  public static toPublicAttendee(attendee: IAttendee): IPublicAttendee {
    return {
      id: attendee.id,
      handle: attendee.handle,
      name: attendee.name,
      headline: attendee.headline,
      avatarUrl: attendee.avatarUrl,
      firstTimer: attendee.profile.firstTimer,
      welcomer: attendee.profile.welcomer,
      xp: attendee.xp,
      badges: attendee.badges,
    };
  }

  public static words(text: string): string[] {
    return (text.toLowerCase().match(/[a-z0-9+#]{3,}/g) ?? []).filter((word) => !stopWords.includes(word));
  }

  public static round(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private static _normalise(topic: string): string {
    return topic.trim().toLowerCase();
  }
}
