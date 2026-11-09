import type { ISession, TalkLevel, TalkTrack } from '../../shared/src/index';
import { levelOnePatterns, levelThreePatterns, nonSessionTitlePatterns, trackRules } from './session-classification.constants';

export function classifyTrack(title: string): TalkTrack {
  for (const rule of trackRules) {
    if (rule.patterns.some((pattern) => pattern.test(title))) {
      return rule.track;
    }
  }

  return 'other';
}

export function classifyLevel(title: string, abstract: string): TalkLevel {
  const combined = `${title} ${abstract}`;
  if (levelOnePatterns.some((pattern) => pattern.test(title))) {
    return 1;
  }
  if (levelThreePatterns.some((pattern) => pattern.test(combined))) {
    return 3;
  }

  return 2;
}

export function isAttendableSession(session: ISession): boolean {
  if (session.venue === 'Off-Site') {
    return false;
  }
  if (session.id.startsWith('cnh-')) {
    return true;
  }
  const durationMinutes = (Date.parse(session.end) - Date.parse(session.start)) / 60000;
  if (durationMinutes < 8 || durationMinutes > 95) {
    return false;
  }

  return !nonSessionTitlePatterns.some((pattern) => pattern.test(session.title));
}
