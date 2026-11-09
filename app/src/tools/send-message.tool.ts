import { z } from 'zod';
import { sendMessage } from '../messages/messages';
import { gameRules } from '../types/kubequest.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const sendMessageTool = defineTool({
  name: 'send_message',
  description: 'Send a plain-text message to the other player in a meet both players accepted. Rate limited per sender.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    meetId: idSchema,
    text: z.string().trim().min(1).max(gameRules.MESSAGE_MAX_CHARS),
  }),
  run: async (input) => sendMessage(input),
});
