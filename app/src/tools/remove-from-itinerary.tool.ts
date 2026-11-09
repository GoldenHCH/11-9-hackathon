import { z } from 'zod';
import { removeFromItinerary } from '../itinerary/itinerary.store';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const removeFromItineraryTool = defineTool({
  name: 'remove_from_itinerary',
  description: "Remove a session from the player's plan. Removing one that is not planned changes nothing.",
  input: z.object({ attendeeId: attendeeIdSchema, talkId: idSchema }),
  run: async (input) => removeFromItinerary(input),
});
