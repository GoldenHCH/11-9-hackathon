import { buildRecap } from '../recap/recap';
import { defineTool } from './define-tool';
import { attendeeInputSchema } from './tool-schemas';

export const recapTool = defineTool({
  name: 'recap',
  description:
    "The player's conference recap: talks (with quiz scores), people met by handshake, booth notes, a next step for each and an email-ready HTML summary.",
  input: attendeeInputSchema,
  run: async (input) => buildRecap(input.attendeeId),
});
