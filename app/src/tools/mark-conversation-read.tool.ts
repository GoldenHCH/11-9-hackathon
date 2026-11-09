import { z } from 'zod';
import { markConversationRead } from '../messages/messages';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const markConversationReadTool = defineTool({
  name: 'mark_conversation_read',
  description: 'Mark every message in one meet conversation as read for this player. Returns the remaining total unread.',
  input: z.object({ attendeeId: attendeeIdSchema, meetId: idSchema }),
  run: async (input) => markConversationRead(input),
});
