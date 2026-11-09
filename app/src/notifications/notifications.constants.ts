import { indexNames } from '../es/es.constants';

export const notificationRules = {
  INDEX: indexNames.MESSAGES,
  KIND: 'notification',
  ID_PREFIX: 'notif:',
  LIST_DEFAULT: 20,
  LIST_MAX: 50,
  MARK_MAX: 200,
  KEY_HASH_LENGTH: 16,
} as const;

export const notificationLinks = {
  QUESTS: '/quests',
  PEOPLE: '/people',
  PROFILE: '/profile',
  MEET_PREFIX: '/intro/',
} as const;

export const nudgeRules = {
  SEEN_WITHIN_MINUTES: 180,
  MAX_PLAYERS: 300,
  QUESTS_PER_RUN: 2,
  MATCHES_PER_RUN: 1,
  QUEST_WINDOW_MINUTES: 30,
  MATCH_WINDOW_MINUTES: 60,
  MATCH_CANDIDATES: 5,
  CONCURRENCY: 4,
  DEFAULT_TOPIC: 'Kubernetes',
} as const;
