import { z } from 'zod';
import { getBossState } from '../quests/boss';
import { defineTool } from './define-tool';
import { idSchema } from './tool-schemas';

export const bossStateTool = defineTool({
  name: 'boss_state',
  description:
    "A boss room's shared health bar: health sized to the room, damage from correct answers, and whether the boss has fallen. Pass attendeeId to also get the boss questions.",
  input: z
    .object({
      talkId: idSchema.optional(),
      locationId: idSchema.optional(),
      attendeeId: idSchema.optional(),
    })
    .refine((input) => input.talkId !== undefined || input.locationId !== undefined, { message: 'Give a talkId or a locationId' }),
  run: async (input) => {
    const attendeeId = 'attendeeId' in input && typeof input.attendeeId === 'string' ? input.attendeeId : undefined;

    return getBossState({ talkId: input.talkId, locationId: input.locationId, attendeeId });
  },
});
