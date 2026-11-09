import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { bannerCatalog, bannerIds } from '../types/kubequest.constants';
import { IBannerProgress } from '../types/kubequest.interfaces';
import { BannerId } from '../types/kubequest.types';
import { awardDueBanners } from './award';
import { IAttendeeInventoryDoc, ILedgerSummary, mergeSummaries, summarizeLedger, summaryFromAttendee } from './xp-ledger';

export const autoAwardedBanners: readonly BannerId[] = ['observability-nerd', 'connector', 'welcomer'];

export interface IInventorySnapshot {
  summary: ILedgerSummary;
  attendee: IAttendeeInventoryDoc;
}

export async function inventorySnapshot(attendeeId: string): Promise<IInventorySnapshot> {
  const [attendeeResponse, ledger] = await Promise.all([
    getEsClient().get<IAttendeeInventoryDoc>(
      { index: indexNames.ATTENDEES, id: attendeeId, _source_includes: ['xp', 'level', 'banners', 'inventory', 'isSpeaker'] },
      esOptions(esTimeouts.DEFAULT_MS),
    ),
    summarizeLedger(attendeeId),
  ]);
  const attendee = attendeeResponse._source ?? {};

  return { summary: mergeSummaries(ledger, summaryFromAttendee(attendee)), attendee };
}

function progressFor(banner: BannerId, summary: ILedgerSummary, isSpeaker: boolean): number {
  switch (banner) {
    case 'observability-nerd':
      return summary.blocks.glass;
    case 'connector':
      return summary.handshakes;
    case 'welcomer':
      return summary.welcomes;
    case 'scout':
      return summary.outpostsToday;
    case 'speaker':
      return isSpeaker ? 1 : 0;
    case 'explorer':
      return 0;
  }
}

export function bannersFromSummary(summary: ILedgerSummary, isSpeaker: boolean): IBannerProgress[] {
  return bannerIds.map((banner) => {
    const definition = bannerCatalog[banner];
    const progress = progressFor(banner, summary, isSpeaker);
    const earnedAt = summary.earnedBanners[banner] || undefined;
    const earned = summary.earnedBanners[banner] !== undefined || (banner === 'speaker' && isSpeaker);

    return {
      id: banner,
      name: definition.name,
      description: definition.description,
      progress: Math.min(progress, definition.target),
      target: definition.target,
      earned,
      ...(earnedAt ? { earnedAt } : {}),
    };
  });
}

export function bannersDue(summary: ILedgerSummary): BannerId[] {
  return autoAwardedBanners.filter((banner) => {
    if (summary.earnedBanners[banner] !== undefined) {
      return false;
    }

    return progressFor(banner, summary, false) >= bannerCatalog[banner].target;
  });
}

export async function bannerProgress(attendeeId: string): Promise<IBannerProgress[]> {
  const { summary, attendee } = await inventorySnapshot(attendeeId);

  return bannersFromSummary(summary, attendee.isSpeaker === true);
}

export async function evaluateBanners(attendeeId: string): Promise<IBannerProgress[]> {
  return awardDueBanners(attendeeId);
}
