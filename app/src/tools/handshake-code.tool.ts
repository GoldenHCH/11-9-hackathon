import { handshakeCode } from '../handshake/handshakes';
import { defineTool } from './define-tool';
import { attendeeInputSchema } from './tool-schemas';

export const handshakeCodeTool = defineTool({
  name: 'handshake_code',
  description:
    "A fresh signed handshake code for the player's own phone (valid 60 seconds, single use). Show scanUrl as a QR and refresh it before expiresAt; the other player scans it to start a handshake.",
  input: attendeeInputSchema,
  run: async (input) => handshakeCode(input.attendeeId),
});
