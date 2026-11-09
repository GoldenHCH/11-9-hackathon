import { z } from 'zod';
import { runCheckIn } from '../checkin/check-in';
import { publicCheckIn } from '../profile/public-id';
import { defineTool } from './define-tool';
import { attendeeIdSchema, geoPointSchema, idSchema } from './tool-schemas';

export const checkInTool = defineTool({
  name: 'check_in',
  description:
    'Credit a QR scan at a room, outpost, theater, campfire or boss room. Verifies the signed token, allows one scan per place per hour, awards XP and a block, completes matching quests and records meet arrivals.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    locationId: idSchema,
    token: z.string().max(512),
    geo: geoPointSchema.optional(),
  }),
  xpAwarded: (output) => output.xpAwarded,
  run: async (input) => publicCheckIn(await runCheckIn(input)),
});
