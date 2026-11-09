import { listConversations } from '../messages/messages';
import { defineTool } from './define-tool';
import { attendeeInputSchema } from './tool-schemas';

export const listConversationsTool = defineTool({
  name: 'list_conversations',
  description:
    "The player's message inbox: one row per person they have an accepted or met meet with, newest activity first, with the partner's public card, the last message and an unread count, plus the total unread.",
  input: attendeeInputSchema,
  run: async (input) => listConversations(input.attendeeId),
});
