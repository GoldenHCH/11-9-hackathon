import { z } from 'zod';
import { findLocation } from '../checkin/lookups';
import { appConfig } from '../config';
import { SCREEN_TOKEN_TTL_MS, signScreenToken } from '../security/tokens';
import { defineTool } from './define-tool';
import { ToolError } from './tool-errors';
import { idSchema } from './tool-schemas';

export const demoScanTokenTool = defineTool({
  name: 'demo_scan_token',
  description:
    'Demo only: return a short-lived screen-token path for a location so the map can simulate a scan. Disabled unless DEMO_SIMULATE_SCANS=true.',
  input: z.object({ locationId: idSchema }),
  run: async ({ locationId }) => {
    if (!appConfig.demoSimulateScans) {
      throw new ToolError(404, 'disabled', 'Simulated scans are switched off.');
    }

    const location = await findLocation(locationId);

    if (!location) {
      throw new ToolError(404, 'unknown_location', "We don't know that place.");
    }

    const expiresAt = new Date(Date.now() + SCREEN_TOKEN_TTL_MS);
    const token = signScreenToken(location.id, expiresAt);

    return { locationId: location.id, path: `/r/${encodeURIComponent(location.id)}?t=${encodeURIComponent(token)}` };
  },
});
