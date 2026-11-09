import { z } from 'zod';
import { answerHandshake } from '../handshake/handshakes';
import { publicHandshake } from '../profile/public-id';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

const MAX_ANSWER_CHARS = 60;

export const answerHandshakeTool = defineTool({
  name: 'answer_handshake',
  description:
    'Submit a handshake answer. The answerer locks in their answer once; the asker types what they heard (2 tries). When both match, the handshake completes, both players earn XP and any accepted meet between them is marked met.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    handshakeId: idSchema,
    answer: z.string().trim().min(1).max(MAX_ANSWER_CHARS),
  }),
  xpAwarded: (output) => output.xpAwarded ?? 0,
  run: async (input) => publicHandshake(await answerHandshake(input)),
});
