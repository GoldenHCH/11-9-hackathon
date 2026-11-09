import { z } from 'zod';
import { computeLeaderboard } from '../boards/leaderboard';
import { publicLeaderboard } from '../profile/public-id';
import { leaderboardBoards, leaderboardPeriods } from '../types/kubequest.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, limitSchema } from './tool-schemas';

export const leaderboardTool = defineTool({
  name: 'leaderboard',
  description:
    "Top players on the overall, connectors or questers board, today or for the whole conference. Each row carries its latest XP event's trace id.",
  input: z.object({
    board: z.enum(leaderboardBoards).optional(),
    period: z.enum(leaderboardPeriods).optional(),
    attendeeId: attendeeIdSchema.optional(),
    limit: limitSchema(100).optional(),
  }),
  run: async (input) => publicLeaderboard(await computeLeaderboard(input)),
});
