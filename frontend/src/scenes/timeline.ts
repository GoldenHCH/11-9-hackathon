import type { Material } from '../engine/iso';
import { along, backOut, easeInOut, easeOut, span } from '../engine/time';

export const LOOP = 16;

export const BEATS = {
  walkIn: [0.2, 2.6],
  scan: 2.6,
  checkIn: 3.0,
  quiz: [3.6, 5.3],
  quizScored: 4.6,
  quest: [5.5, 6.7],
  walkToFire: [6.7, 10.0],
  meet: 10.1,
  gem: [10.4, 11.4],
  levelUp: 11.8,
  fadeOut: [15.2, 15.9],
} as const;

const ROUTE_IN = [
  [-0.6, 7],
  [3, 7],
  [3, 5.95],
] as const;
const ROUTE_FIRE = [
  [3, 5.95],
  [3, 7],
  [7, 7],
  [7, 9],
] as const;
const ROUTE_B = [
  [11, 4.9],
  [11, 7],
  [9, 7],
  [9, 9],
] as const;

export const QR_A = { x: 3.2, y: 5.05 };
export const FIRE = { x: 8, y: 9 };

export const HANDLES = { you: 'you', match: 'quietgopher' } as const;

export type Pop = { key: string; text: string; x: number; y: number; z: number; p: number; tone: 'xp' | 'gem' };
export type Toast = { key: string; title: string; body: string; p: number; out: number };

const hopAt = (t: number, walking: boolean) => (walking ? (Math.floor(t * 7) % 2) * 0.09 : 0);

const BASE_XP = 40;
export const LEVELS = ['Pod', 'Deployment', 'Node', 'Cluster', 'Control Plane'] as const;
export const LEVEL_XP = 100;

export const worldState = (raw: number) => {
  const t = ((raw % LOOP) + LOOP) % LOOP;
  const fade = 1 - span(t, BEATS.fadeOut[0], BEATS.fadeOut[1]);
  const appear = span(t, 0, 0.3);

  const pIn = easeInOut(span(t, BEATS.walkIn[0], BEATS.walkIn[1]));
  const pFire = easeInOut(span(t, BEATS.walkToFire[0], BEATS.walkToFire[1]));
  const walkingA =
    (t > BEATS.walkIn[0] && t < BEATS.walkIn[1]) || (t > BEATS.walkToFire[0] && t < BEATS.walkToFire[1]);
  const [ax, ay] = t < BEATS.walkToFire[0] ? along(ROUTE_IN, pIn) : along(ROUTE_FIRE, pFire);

  const pB = easeInOut(span(t, BEATS.walkToFire[0] + 0.3, BEATS.walkToFire[1] - 0.1));
  const walkingB = t > BEATS.walkToFire[0] + 0.3 && t < BEATS.walkToFire[1] - 0.1;
  const [bx, by] = along(ROUTE_B, pB);
  const bVisible = span(t, BEATS.quest[0], BEATS.quest[0] + 0.6);

  const scanP = span(t, BEATS.scan, BEATS.scan + 0.9);
  const scanGlow = scanP > 0 && scanP < 1 ? Math.round((1 - scanP) * 4) / 4 * 0.7 : 0;

  const pops: Pop[] = [];
  const popP = span(t, BEATS.checkIn, BEATS.checkIn + 1.5);
  if (popP > 0 && popP < 1) pops.push({ key: 'ci', text: '+10 XP', x: QR_A.x + 0.3, y: QR_A.y, z: 1.6, p: popP, tone: 'xp' });
  const meetP = span(t, BEATS.meet, BEATS.meet + 1.6);
  if (meetP > 0 && meetP < 1) {
    pops.push({ key: 'ma', text: '+50 XP', x: 7.2, y: 9.2, z: 1.8, p: meetP, tone: 'xp' });
    pops.push({ key: 'mb', text: '+50 XP', x: 9.4, y: 9.2, z: 1.8, p: meetP, tone: 'xp' });
  }

  const fly: { m: Material; x: number; y: number; z: number; s: number } | null = (() => {
    const p = span(t, BEATS.checkIn, BEATS.checkIn + 1.0);
    if (p > 0 && p < 1) return { m: 'glass', x: QR_A.x, y: QR_A.y, z: 1 + easeOut(p) * 3.2, s: 1 - p * 0.4 };
    const g = span(t, BEATS.gem[0], BEATS.gem[1]);
    if (g > 0 && g < 1) return { m: 'gem', x: FIRE.x + 0.2, y: FIRE.y + 0.2, z: 1.2 + easeOut(g) * 3.4, s: 0.8 };
    return null;
  })();

  const flare = span(t, BEATS.meet, BEATS.meet + 0.4) * (1 - span(t, BEATS.meet + 1.4, BEATS.meet + 2.4));

  let xp = BASE_XP;
  if (t >= BEATS.checkIn) xp += 10;
  if (t >= BEATS.quizScored) xp += 15;
  if (t >= BEATS.meet) xp += 50;
  const leveled = t >= BEATS.levelUp;
  const level = leveled ? 1 : 0;
  const barTarget = leveled ? (xp - LEVEL_XP) / LEVEL_XP : Math.min(1, xp / LEVEL_XP);
  const barP = leveled ? backOut(span(t, BEATS.levelUp, BEATS.levelUp + 0.6)) * barTarget : barTarget;

  const toasts: Toast[] = [];
  const toast = (key: string, title: string, body: string, a: number, b: number) => {
    const p = span(t, a, a + 0.35);
    const out = span(t, b - 0.3, b);
    if (p > 0 && out < 1) toasts.push({ key, title, body, p, out });
  };
  toast('ci', 'Checked in', 'Room 255 BC, Operations + Performance. +10 XP and a glass block.', BEATS.checkIn, BEATS.quiz[0] + 0.1);
  toast('quiz', 'Quiz: 3 of 3 correct', 'You listened to the talk on tracing Argo CD syncs. +15 XP.', BEATS.quiz[0] + 0.2, BEATS.quest[0]);
  toast('quest', 'Meet quest accepted', '@quietgopher is fighting the same sync bug. Campfire: Community Hub, now.', BEATS.quest[0], BEATS.meet);
  toast('ice', 'Handshake verified', 'Both of you scanned the campfire. +50 XP each and a gem.', BEATS.meet + 0.2, BEATS.levelUp);
  toast('lvl', 'Level up', 'You reached Deployment. 3 blocks, 1 gem, 1 new person.', BEATS.levelUp, BEATS.fadeOut[0]);

  const inventory: Material[] = ['stone', 'circuit'];
  if (t >= BEATS.checkIn + 1.0) inventory.push('glass');
  if (t >= BEATS.gem[1]) inventory.push('gem');

  return {
    t,
    a: { x: ax, y: ay, hop: hopAt(t, walkingA), alpha: Math.min(appear, fade) },
    b: { x: bx, y: by, hop: hopAt(t + 0.07, walkingB), alpha: Math.min(bVisible, fade) },
    scanGlow,
    ring: scanP > 0 && scanP < 1 ? scanP : 0,
    pops,
    fly,
    flare,
    xp,
    level,
    bar: barP,
    toasts,
    inventory,
    newSlot: t >= BEATS.gem[1] ? span(t, BEATS.gem[1], BEATS.gem[1] + 0.4) : span(t, BEATS.checkIn + 1.0, BEATS.checkIn + 1.4),
  };
};

export type WorldState = ReturnType<typeof worldState>;
