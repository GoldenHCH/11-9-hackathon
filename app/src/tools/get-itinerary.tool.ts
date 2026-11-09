import { z } from 'zod';
import { getItinerary } from '../itinerary/itinerary';
import { defineTool } from './define-tool';
import { attendeeIdSchema, daySchema } from './tool-schemas';

export const getItineraryTool = defineTool({
  name: 'get_itinerary',
  description:
    "The player's own plan in time order: planned sessions, accepted meets and timed quests, with walking minutes between them, overlaps flagged and free gaps of 30 minutes or more.",
  input: z.object({ attendeeId: attendeeIdSchema, day: daySchema.optional() }),
  run: async (input) => getItinerary(input),
});
