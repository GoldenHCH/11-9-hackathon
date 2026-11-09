import { z } from 'zod';
import { addToItinerary } from '../itinerary/itinerary.store';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const addToItineraryTool = defineTool({
  name: 'add_to_itinerary',
  description: "Add a session to the player's plan. Adding one that is already planned changes nothing.",
  input: z.object({ attendeeId: attendeeIdSchema, talkId: idSchema }),
  run: async (input) => addToItinerary(input),
});
