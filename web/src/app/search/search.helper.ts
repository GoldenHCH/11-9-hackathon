import { IMeet } from '../core/api.types';
import { searchMapLevels, searchSettings } from './search.constants';
import { ConnectState, IAnswerSegment } from './search.types';

const meetRank: Record<IMeet['status'], number> = { accepted: 5, met: 4, proposed: 3, declined: 2, cancelled: 1, expired: 0 };

export class SearchHelper {
  public static mapLevel(building: string, level: string, zone?: string): string | null {
    const buildingKey = building.trim().toLowerCase();
    const byZone = zone ? searchMapLevels[`${buildingKey}|${zone.trim().toLowerCase()}`] : undefined;

    return byZone ?? searchMapLevels[`${buildingKey}|${level.trim().toLowerCase()}`] ?? null;
  }

  public static meetsByPartner(meets: IMeet[]): Map<string, IMeet> {
    const index = new Map<string, IMeet>();

    for (const meet of meets) {
      const current = index.get(meet.partner.id);

      if (!current || meetRank[meet.status] > meetRank[current.status]) {
        index.set(meet.partner.id, meet);
      }
    }

    return index;
  }

  public static connectState(meet: IMeet | undefined): ConnectState {
    if (!meet) {
      return 'connect';
    }

    if (meet.status === 'accepted' || meet.status === 'met') {
      return 'open';
    }

    if (meet.status === 'proposed') {
      return meet.role === 'partner' && !meet.iAccepted ? 'respond' : 'waiting';
    }

    return 'connect';
  }

  public static segments(answer: string): IAnswerSegment[] {
    return answer
      .split(/(\[\d+\])/g)
      .filter((part) => part !== '')
      .map((part) => {
        const match = /^\[(\d+)\]$/.exec(part);

        return match ? { text: part, citation: Number(match[1]) } : { text: part };
      });
  }

  public static anchorId(resultId: string): string {
    return `result-${resultId.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  }

  public static when(iso: string): string {
    const date = new Date(iso);

    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      timeZone: searchSettings.TIME_ZONE,
    }).format(date);
  }
}
