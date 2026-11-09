import { z } from 'zod';
import { findLocation } from '../checkin/lookups';
import { appConfig } from '../config';
import { signLocationToken } from '../security/tokens';
import { defineTool } from './define-tool';
import { ToolError } from './tool-errors';
import { idSchema } from './tool-schemas';

export const demoScanTokenTool = defineTool({
  name: 'demo_scan_token',
  description:
    'Demo only: return the printed-QR path for a location so the map can simulate a scan. Disabled unless DEMO_SIMULATE_SCANS=true.',
  input: z.object({ locationId: idSchema }),
  run: async ({ locationId }) => {
    if (!appConfig.demoSimulateScans) {
      throw new ToolError(404, 'disabled', 'Simulated scans are switched off.');
    }

    const location = await findLocation(locationId);

    if (!location) {
      throw new ToolError(404, 'unknown_location', "We don't know that place.");
    }

    const token = signLocationToken(location.id);

    return { locationId: location.id, path: `/r/${encodeURIComponent(location.id)}?t=${encodeURIComponent(token)}` };
  },
});
