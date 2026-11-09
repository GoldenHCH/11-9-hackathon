import { IInventory, ILevelProgress } from '../types/kubequest.interfaces';
import { bannersFromSummary, inventorySnapshot } from '../xp/banners';
import { levelProgress } from '../xp/levels';
import { defineTool } from './define-tool';
import { ToolError } from './tool-errors';
import { attendeeInputSchema } from './tool-schemas';

export interface IInventoryWithLevel extends IInventory {
  xp: number;
  level: ILevelProgress;
  nextLevelXp: number | null;
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && Reflect.get(error, 'statusCode') === 404;
}

export const inventoryTool = defineTool({
  name: 'inventory',
  description:
    'Level, XP, next level threshold, blocks per material, gems and banner progress, aggregated from the XP ledger.',
  input: attendeeInputSchema,
  run: async ({ attendeeId }) => {
    const snapshot = await inventorySnapshot(attendeeId).catch((error: unknown) => {
      if (isNotFound(error)) {
        throw new ToolError(404, 'unknown_attendee', 'We could not find that player.');
      }

      throw error;
    });
    const { summary, attendee } = snapshot;
    const level = levelProgress(attendee.xp ?? 0);
    const inventory: IInventoryWithLevel = {
      blocks: summary.blocks,
      totalBlocks: summary.totalBlocks,
      gems: summary.gems,
      banners: bannersFromSummary(summary, attendee.isSpeaker === true),
      xp: level.xp,
      level,
      nextLevelXp: level.nextLevelXp,
    };

    return inventory;
  },
});
