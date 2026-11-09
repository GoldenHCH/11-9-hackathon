import { defineTool } from './define-tool';
import { whatsNext } from '../match/next';
import { attendeeInputSchema } from './tool-schemas';

export const whatsNextTool = defineTool({
  name: 'whats_next',
  description:
    "The player's itinerary: the Now card and accepted talks, meets and quests in time order with walking minutes.",
  input: attendeeInputSchema,
  run: async (input) => whatsNext(input.attendeeId),
});
