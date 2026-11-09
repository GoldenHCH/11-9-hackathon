import { computeOrganizerStats } from '../boards/organizer-stats';
import { adminAccessScope, verifyAccessKey } from '../security/tokens';
import { ToolError } from '../tools/tool-errors';
import { IAdminOverview, IAdminOverviewInput, IExhibitorGroupStat, IExhibitorStatRow, ILocation } from '../types/kubequest.interfaces';
import { exhibitorMessages, unassignedZone } from './exhibitors.constants';
import { IBoothCounts, IBoothStats } from './exhibitors.interfaces';
import { exhibitorTypeOf, loadOutposts, outpostScanUrl, outpostStaffUrl, tierOf, tierRank, toExhibitorCard } from './outposts';
import { boothStats, questStatusesByBooth, settle } from './visits';

const emptyCounts: IBoothCounts = { visits: 0, unique: 0, now: 0 };

export function assertAdminKey(key: string): void {
  if (!verifyAccessKey(adminAccessScope(), key)) {
    throw new ToolError(403, 'bad_key', exhibitorMessages.BAD_ADMIN_KEY);
  }
}

function groupStats(outposts: ILocation[], stats: IBoothStats, groupOf: (location: ILocation) => string): IExhibitorGroupStat[] {
  const groups = new Map<string, IExhibitorGroupStat>();

  for (const outpost of outposts) {
    const value = groupOf(outpost);
    const group = groups.get(value) ?? { value, exhibitors: 0, visits: 0 };
    group.exhibitors += 1;
    group.visits += stats.byBooth.get(outpost.id)?.visits ?? 0;
    groups.set(value, group);
  }

  return [...groups.values()];
}

function statRow(outpost: ILocation, counts: IBoothCounts, questsCompleted: number): IExhibitorStatRow {
  return {
    exhibitor: toExhibitorCard(outpost, counts.now),
    visitsToday: counts.visits,
    uniqueToday: counts.unique,
    questsCompleted,
    staffUrl: outpostStaffUrl(outpost.id),
    scanUrl: outpostScanUrl(outpost.id),
  };
}

function compareRows(left: IExhibitorStatRow, right: IExhibitorStatRow): number {
  return (
    right.visitsToday - left.visitsToday ||
    right.uniqueToday - left.uniqueToday ||
    tierRank(left.exhibitor.tier) - tierRank(right.exhibitor.tier) ||
    left.exhibitor.boothNumber.localeCompare(right.exhibitor.boothNumber, 'en', { numeric: true })
  );
}

export async function adminOverview(input: IAdminOverviewInput): Promise<IAdminOverview> {
  assertAdminKey(input.key);

  const outposts = await loadOutposts();
  const ids = outposts.map((outpost) => outpost.id);
  const emptyStats: IBoothStats = { byBooth: new Map(), visits: 0, unique: 0 };

  const [stats, booths, completed] = await Promise.all([
    computeOrganizerStats({ since: input.since }),
    settle('admin.booths', boothStats(ids, input.since), emptyStats),
    settle('admin.quests', questStatusesByBooth(ids, 'completed'), new Map<string, Map<string, number>>()),
  ]);

  const table = outposts
    .map((outpost) => statRow(outpost, booths.byBooth.get(outpost.id) ?? emptyCounts, completed.get(outpost.id)?.get('completed') ?? 0))
    .sort(compareRows);

  return {
    stats,
    exhibitors: {
      total: outposts.length,
      sponsors: outposts.filter((outpost) => exhibitorTypeOf(outpost) === 'sponsor').length,
      projects: outposts.filter((outpost) => exhibitorTypeOf(outpost) === 'project').length,
      visitedToday: table.filter((row) => row.visitsToday > 0).length,
      visitsToday: booths.visits,
      uniqueVisitorsToday: booths.unique,
    },
    byTier: groupStats(outposts, booths, tierOf).sort((left, right) => tierRank(left.value) - tierRank(right.value) || left.value.localeCompare(right.value)),
    byZone: groupStats(outposts, booths, (outpost) => outpost.zone ?? unassignedZone).sort(
      (left, right) => right.visits - left.visits || right.exhibitors - left.exhibitors || left.value.localeCompare(right.value),
    ),
    table,
    generatedAt: new Date().toISOString(),
  };
}
