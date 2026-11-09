import { z } from 'zod';
import { proposeMeet } from '../meet/meets';
import { publicMeet, resolvePlayerId } from '../profile/public-id';
import { defineTool } from './define-tool';
import { ToolError } from './tool-errors';
import { attendeeIdSchema } from './tool-schemas';

export const proposeMeetTool = defineTool({
  name: 'propose_meet',
  description:
    'Accept a chat quest with another player (partnerId is their public id, pl_...). Nothing personal is shared until both accept; then the game picks the nearest campfire, a time, an opening line and a match signal.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    partnerId: attendeeIdSchema,
  }),
  run: async (input) => {
    const partnerId = await resolvePlayerId(input.partnerId);

    if (partnerId === input.attendeeId) {
      throw new ToolError(400, 'invalid_input', 'That request is missing something: You cannot meet yourself');
    }

    return publicMeet(await proposeMeet({ attendeeId: input.attendeeId, partnerId }));
  },
});
