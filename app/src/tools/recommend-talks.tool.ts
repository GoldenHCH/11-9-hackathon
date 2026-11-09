import { z } from 'zod';
import { defineTool } from './define-tool';
import { recommendTalksFor } from '../match/talks';
import { attendeeIdSchema, limitSchema } from './tool-schemas';

export const recommendTalksTool = defineTool({
  name: 'recommend_talks',
  description:
    "Sessions that match the player's topics and start soon, ranked by hybrid search, with a reason and walking minutes.",
  input: z.object({
    attendeeId: attendeeIdSchema,
    limit: limitSchema(20).optional(),
    withinMinutes: z.number().int().min(5).max(720).optional(),
  }),
  run: async (input) => recommendTalksFor(input.attendeeId, { limit: input.limit, withinMinutes: input.withinMinutes }),
});
