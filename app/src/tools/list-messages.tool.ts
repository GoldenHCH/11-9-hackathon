import { z } from 'zod';
import { listMessages } from '../messages/messages';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema, isoDateSchema } from './tool-schemas';

export const listMessagesTool = defineTool({
  name: 'list_messages',
  description: 'Messages in one meet, oldest first, each marked fromMe. Pass since to fetch only newer ones.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    meetId: idSchema,
    since: isoDateSchema.optional(),
  }),
  run: async (input) => listMessages(input),
});
