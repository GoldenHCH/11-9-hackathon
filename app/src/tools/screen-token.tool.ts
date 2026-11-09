import { z } from 'zod';
import { findLocation } from '../checkin/lookups';
import { buildScanUrl, SCREEN_TOKEN_TTL_MS, signScreenToken } from '../security/tokens';
import { defineTool } from './define-tool';
import { ToolError } from './tool-errors';
import { idSchema } from './tool-schemas';

export const screenTokenTool = defineTool({
  name: 'screen_token',
  description:
    'Mint a 10-minute signed token and scan URL for a location that has a screen (the demo room or a boss room slide).',
  input: z.object({ locationId: idSchema }),
  run: async ({ locationId }) => {
    const location = await findLocation(locationId);

    if (!location) {
      throw new ToolError(404, 'unknown_location', "We don't know that place. Check the code on the screen.");
    }

    if (!location.hasScreen) {
      throw new ToolError(403, 'no_screen', `${location.name} has no screen. Scan the printed code on its door.`);
    }

    const expiresAt = new Date(Date.now() + SCREEN_TOKEN_TTL_MS);
    const token = signScreenToken(location.id, expiresAt);

    return { locationId: location.id, token, expiresAt: expiresAt.toISOString(), scanUrl: buildScanUrl(location.id, token) };
  },
});
