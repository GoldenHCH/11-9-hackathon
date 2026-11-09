import { z } from 'zod';
import { defineTool } from './define-tool';
import { updateSettings } from '../profile/update-settings';
import { intentDescription, intentSchema } from './intent-schema';
import { attendeeIdSchema, topicsSchema } from './tool-schemas';

export const updateSettingsTool = defineTool({
  name: 'update_settings',
  description:
    'Change comfort and meeting settings, topics, the "working on" line or "how to spot me". Turning meeting off withdraws every open meet offer. ' + intentDescription,
  input: z.object({
    attendeeId: attendeeIdSchema,
    settings: z
      .object({
        meetingOn: z.boolean(),
        accessibleMode: z.boolean(),
        noWalking: z.boolean(),
        locationOn: z.boolean(),
        language: z.string().trim().min(2).max(10),
        hideFromLeaderboard: z.boolean(),
      })
      .partial()
      .optional(),
    topics: topicsSchema.optional(),
    workingOn: z.string().trim().max(500).optional(),
    spotMe: z.string().trim().max(140).optional(),
    realName: z.string().trim().max(80).optional(),
    visible: z.boolean().optional(),
    intent: intentSchema.optional(),
  }),
  run: updateSettings,
});
