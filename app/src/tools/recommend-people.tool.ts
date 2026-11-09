import { z } from 'zod';
import { defineTool } from './define-tool';
import { recommendPeopleFor } from '../match/people';
import { publicPersonMatch } from '../profile/public-id';
import { attendeeIdSchema, limitSchema } from './tool-schemas';

export const recommendPeopleTool = defineTool({
  name: 'recommend_people',
  description:
    'Players with meeting turned on who work on similar things, ranked by hybrid search over their profiles, with shared topics and a reason. hereOnly limits to players in the same room.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    hereOnly: z.boolean().optional(),
    limit: limitSchema(20).optional(),
  }),
  run: async (input) => (await recommendPeopleFor(input.attendeeId, { hereOnly: input.hereOnly, limit: input.limit })).map(publicPersonMatch),
});
