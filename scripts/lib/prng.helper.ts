import type { IPrng } from './prng.interfaces';

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function createPrng(seed: number): IPrng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);

    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };

  const int = (minimum: number, maximum: number): number => {
    return minimum + Math.floor(next() * (maximum - minimum + 1));
  };

  const chance = (probability: number): boolean => {
    return next() < probability;
  };

  const pick = <T>(items: readonly T[]): T => {
    return items[Math.floor(next() * items.length)];
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const swapIndex = Math.floor(next() * (i + 1));
      const held = copy[i];
      copy[i] = copy[swapIndex];
      copy[swapIndex] = held;
    }

    return copy;
  };

  const weightedPick = <T>(items: readonly T[], weights: readonly number[]): T => {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let threshold = next() * total;
    for (let i = 0; i < items.length; i++) {
      threshold -= weights[i];
      if (threshold < 0) {
        return items[i];
      }
    }

    return items[items.length - 1];
  };

  return { next, int, chance, pick, shuffle, weightedPick };
}
