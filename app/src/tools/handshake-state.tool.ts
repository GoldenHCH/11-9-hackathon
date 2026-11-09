import { z } from 'zod';
import { handshakeState } from '../handshake/handshakes';
import { publicHandshakeState } from '../profile/public-id';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const handshakeStateTool = defineTool({
  name: 'handshake_state',
  description:
    "One handshake from the caller's view (by handshakeId), or without an id the caller's newest open handshake. The phone showing its code polls this to learn it was scanned.",
  input: z.object({
    attendeeId: attendeeIdSchema,
    handshakeId: idSchema.optional(),
  }),
  run: async (input) => publicHandshakeState(await handshakeState(input)),
});
