import { walkTimes } from '../types/kubequest.constants';
import { IWalkPoint } from '../types/internal.interfaces';

export function walkMinutes(from: IWalkPoint | undefined, to: IWalkPoint | undefined): number | undefined {
  if (!from || !to) {
    return undefined;
  }

  if (from.id === to.id) {
    return walkTimes.SAME_ROOM;
  }

  if (from.building !== to.building) {
    return walkTimes.OTHER_BUILDING;
  }

  return from.level === to.level ? walkTimes.SAME_LEVEL : walkTimes.OTHER_LEVEL;
}
