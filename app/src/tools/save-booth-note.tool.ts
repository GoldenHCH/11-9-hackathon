import { z } from 'zod';
import { saveBoothNote } from '../booth/booth-notes';
import { gameRules } from '../types/kubequest.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const saveBoothNoteTool = defineTool({
  name: 'save_booth_note',
  description:
    "Save the player's takeaway from a booth (what they liked, thoughts, follow-up). Earns outpost XP once per booth when the note is long enough, the daily cap is not hit and a few minutes passed since the last booth XP.",
  input: z.object({
    attendeeId: attendeeIdSchema,
    locationId: idSchema,
    liked: z.string().trim().max(gameRules.BOOTH_NOTE_MAX_CHARS),
    thoughts: z.string().trim().max(gameRules.BOOTH_NOTE_MAX_CHARS).optional(),
    followUp: z.boolean().optional(),
  }),
  xpAwarded: (output) => output.xpAwarded,
  run: async (input) => saveBoothNote(input),
});
