import { z } from 'zod';
import { respondMeet } from '../meet/meets';
import { publicMeet } from '../profile/public-id';
import { meetResponses } from '../types/kubequest.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const respondMeetTool = defineTool({
  name: 'respond_meet',
  description:
    "Answer a meet: accept, decline (silent to the other player), later (keeps a live request open as a normal offer for 30 minutes, no popup again) or can't make it (until the first scan). blockPartner stops future matches with that player.",
  input: z.object({
    attendeeId: attendeeIdSchema,
    meetId: idSchema,
    response: z.enum(meetResponses),
    blockPartner: z.boolean().optional(),
  }),
  xpAwarded: (output) => output.xpAwarded,
  run: async (input) => {
    const result = await respondMeet(input);

    return { ...result, meet: publicMeet(result.meet) };
  },
});
