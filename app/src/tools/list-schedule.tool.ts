import { z } from 'zod';
import { itineraryRules } from '../itinerary/itinerary.constants';
import { listSchedule } from '../itinerary/schedule';
import { tracks } from '../types/kubequest.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, daySchema, isoDateSchema } from './tool-schemas';

export const listScheduleTool = defineTool({
  name: 'list_schedule',
  description:
    'Everything on the schedule for one conference day, grouped into 30-minute slots, with live check-in counts and whether each session is in the caller’s plan.',
  input: z.object({
    attendeeId: attendeeIdSchema.optional(),
    day: daySchema.optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    track: z.enum(tracks).optional(),
    building: z.string().trim().min(1).max(80).optional(),
    query: z.string().trim().max(itineraryRules.MAX_QUERY_LENGTH).optional(),
  }),
  run: async (input) => listSchedule(input),
});
