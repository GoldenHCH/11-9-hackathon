import { IMeet, IPersonMatch } from '../core/api.types';
import { PersonAction } from './people.types';

const statusRank: Record<IMeet['status'], number> = {
  accepted: 5,
  proposed: 4,
  met: 3,
  declined: 2,
  cancelled: 1,
  expired: 0,
};

export class PeopleHelper {
  public static meetsByPartner(meets: IMeet[]): Map<string, IMeet> {
    const index = new Map<string, IMeet>();

    for (const meet of meets) {
      const current = index.get(meet.partner.id);

      if (!current || statusRank[meet.status] > statusRank[current.status]) {
        index.set(meet.partner.id, meet);
      }
    }

    return index;
  }

  public static actionFor(match: IPersonMatch, meet: IMeet | undefined): PersonAction {
    const status = meet?.status ?? match.meetStatus;

    if (status === 'accepted' || status === 'met') {
      return meet ? 'open' : 'waiting';
    }

    if (status === 'proposed') {
      return meet && !meet.iAccepted ? 'accept' : 'waiting';
    }

    if (status === 'declined' && meet?.role === 'proposer') {
      return 'closed';
    }

    return 'propose';
  }

  public static incomingOffers(meets: IMeet[], shownPartnerIds: Set<string>): IMeet[] {
    return meets.filter(
      (meet) => meet.status === 'proposed' && meet.role === 'partner' && !meet.iAccepted && !shownPartnerIds.has(meet.partner.id),
    );
  }

  public static isWelcomer(match: IPersonMatch): boolean {
    return match.player.banners.includes('welcomer');
  }
}
