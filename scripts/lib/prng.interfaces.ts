export interface IPrng {
  next: () => number;
  int: (minimum: number, maximum: number) => number;
  chance: (probability: number) => boolean;
  pick: <T>(items: readonly T[]) => T;
  shuffle: <T>(items: readonly T[]) => T[];
  weightedPick: <T>(items: readonly T[], weights: readonly number[]) => T;
}
