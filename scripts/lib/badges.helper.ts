import type { IBadgeInput, IEarnedBadge } from './data-scripts.interfaces';
import { toEpochMs } from './time.helper';

export const badgeNames = {
  OBSERVABILITY_NERD: 'Observability Nerd',
  CONNECTOR: 'Connector',
  WELCOMER: 'Welcomer',
};

export const badgeXp = 20;

function nthEarliest(timestamps: string[], position: number): string | undefined {
  const sorted = [...timestamps].sort((first, second) => toEpochMs(first) - toEpochMs(second));

  return sorted[position - 1];
}

export function computeBadges(input: IBadgeInput): IEarnedBadge[] {
  const earned: IEarnedBadge[] = [];

  const observabilityCheckIns = input.checkIns
    .filter((checkIn) => checkIn.track === 'observability')
    .map((checkIn) => checkIn.at);
  const nerdAt = nthEarliest(observabilityCheckIns, 3);
  if (nerdAt) {
    earned.push({ name: badgeNames.OBSERVABILITY_NERD, earnedAt: nerdAt });
  }

  const connectorAt = nthEarliest(
    input.handshakes.map((handshake) => handshake.at),
    3,
  );
  if (connectorAt) {
    earned.push({ name: badgeNames.CONNECTOR, earnedAt: connectorAt });
  }

  if (!input.firstTimer) {
    const welcomerAt = nthEarliest(
      input.handshakes.filter((handshake) => handshake.counterpartFirstTimer).map((handshake) => handshake.at),
      2,
    );
    if (welcomerAt) {
      earned.push({ name: badgeNames.WELCOMER, earnedAt: welcomerAt });
    }
  }

  return earned;
}
