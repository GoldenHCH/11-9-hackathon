import { BossDamageSkip } from './quiz.types';

export const bossPollMs = 5000;

export const bossSkipFallbackMessages: Record<BossDamageSkip, string> = {
  not_checked_in: "Your answers were graded, but they didn't hit the boss: scan the boss room's QR during the session to join the fight.",
  outside_fight_window: "Your answers were graded, but the boss fight isn't on right now, so they didn't hit the boss.",
};
