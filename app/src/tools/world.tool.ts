import { z } from 'zod';
import { buildWorld } from '../world/world';
import { defineTool } from './define-tool';
import { attendeeIdSchema } from './tool-schemas';

export const worldTool = defineTool({
  name: 'world',
  description:
    'The world map: buildings, then levels, then rooms, each with the session on now and next and how busy it is (check-ins in the last 20 minutes).',
  input: z.object({
    attendeeId: attendeeIdSchema.optional(),
  }),
  run: async (input) => buildWorld(input),
});
