import { DeclineReason, Material, QuestType } from './quests.types';

export interface IQuestTypeMeta {
  label: string;
  icon: string;
  colorVar: string;
}

export const questTypeMeta: Record<QuestType, IQuestTypeMeta> = {
  attend: { label: 'Attend', icon: 'event_seat', colorVar: 'var(--kq-circuit, #2e7d32)' },
  quiz: { label: 'Quiz', icon: 'quiz', colorVar: 'var(--kq-glass, #4fc3f7)' },
  chat: { label: 'Chat', icon: 'forum', colorVar: 'var(--kq-lantern, #ffb300)' },
  outpost: { label: 'Outpost', icon: 'storefront', colorVar: 'var(--kq-copper, #c96a12)' },
  collection: { label: 'Collection', icon: 'collections_bookmark', colorVar: 'var(--kq-wood, #8d6e63)' },
  boss: { label: 'Boss', icon: 'local_fire_department', colorVar: 'var(--kq-danger, #c62828)' },
};

export const materialColors: Record<Material, string> = {
  circuit: 'var(--kq-circuit, #2e7d32)',
  stone: 'var(--kq-stone, #8a8a8a)',
  glass: 'var(--kq-glass, #4fc3f7)',
  crate: 'var(--kq-crate, #a1887f)',
  iron: 'var(--kq-iron, #b0bec5)',
  copper: 'var(--kq-copper, #c96a12)',
  lantern: 'var(--kq-lantern, #ffb300)',
  wood: 'var(--kq-wood, #8d6e63)',
  gold: 'var(--kq-gold, #fdd835)',
};

export const declineReasonOptions: { value: DeclineReason; label: string }[] = [
  { value: 'not_my_topic', label: 'Not my topic' },
  { value: 'too_far', label: 'Too far' },
  { value: 'no_time', label: 'No time' },
];

export const questBoardPollMs = 30000;

export const bossPollMs = 5000;
