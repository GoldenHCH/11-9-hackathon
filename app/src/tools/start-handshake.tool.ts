import { z } from 'zod';
import { startHandshake } from '../handshake/handshakes';
import { publicHandshake } from '../profile/public-id';
import { defineTool } from './define-tool';
import { attendeeIdSchema } from './tool-schemas';

export const startHandshakeTool = defineTool({
  name: 'start_handshake',
  description:
    "Scan another player's handshake code. Verifies it, then picks one question about them (shared topic, booth notes, talks, what they work on) that they answer in 1 to 3 words. Returns the handshake from the asker's view.",
  input: z.object({
    attendeeId: attendeeIdSchema,
    token: z.string().trim().min(1).max(512),
  }),
  run: async (input) => publicHandshake(await startHandshake(input)),
});
