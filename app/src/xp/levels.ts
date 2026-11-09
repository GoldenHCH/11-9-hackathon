import { playerLevels } from '../types/kubequest.constants';
import { ILevelDefinition, ILevelProgress } from '../types/kubequest.interfaces';

export function levelDefinitionForXp(xp: number): ILevelDefinition {
  const reached = playerLevels.filter((definition) => xp >= definition.minXp);

  return reached[reached.length - 1] ?? playerLevels[0];
}

export function levelProgress(xp: number): ILevelProgress {
  const current = levelDefinitionForXp(xp);
  const next = playerLevels.find((definition) => definition.minXp > xp);

  if (!next) {
    return { level: current.level, name: current.name, xp, levelMinXp: current.minXp, nextLevelXp: null, nextLevelName: null, progress: 1 };
  }

  const progress = (xp - current.minXp) / (next.minXp - current.minXp);

  return {
    level: current.level,
    name: current.name,
    xp,
    levelMinXp: current.minXp,
    nextLevelXp: next.minXp,
    nextLevelName: next.name,
    progress: Math.min(1, Math.max(0, progress)),
  };
}

export function leveledUp(xpBefore: number, xpAfter: number): boolean {
  return levelDefinitionForXp(xpAfter).level > levelDefinitionForXp(xpBefore).level;
}
