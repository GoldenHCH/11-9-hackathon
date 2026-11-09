import { z } from 'zod';
import { getExhibitorPage } from '../exhibitors/page';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const getExhibitorTool = defineTool({
  name: 'get_exhibitor',
  description:
    "One booth's page: the exhibitor, live visitor counts, talks by its people, players there now who turned meeting on, the 4 nearest booths by geo distance, and whether the caller visited it and has its booth quest.",
  input: z.object({
    outpostId: idSchema,
    attendeeId: attendeeIdSchema.optional(),
  }),
  run: async (input) => getExhibitorPage(input),
});
