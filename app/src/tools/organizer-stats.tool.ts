import { z } from 'zod';
import { computeOrganizerStats } from '../boards/organizer-stats';
import { defineTool } from './define-tool';
import { isoDateSchema } from './tool-schemas';

export const organizerStatsTool = defineTool({
  name: 'organizer_stats',
  description:
    'Organizer view: players, check-ins, XP by type, the meet funnel, quest statuses, busiest rooms and boss fights.',
  input: z.object({
    since: isoDateSchema.optional(),
  }),
  run: async (input) => computeOrganizerStats(input),
});
