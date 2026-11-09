import { z } from 'zod';
import { uploadBoothPhoto } from '../photos/booth-photos';
import { gameRules } from '../types/kubequest.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

const MAX_DATA_URL_CHARS = 600_000;

export const uploadBoothPhotoTool = defineTool({
  name: 'upload_booth_photo',
  description:
    'Add a photo of a booth (outpost) for everyone to see on the map. The player must have scanned that booth in the last 30 minutes. Earns 15 XP once per booth and completes a photo quest for it. The image is a JPEG, PNG or WebP data URL up to 400 KB.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    locationId: idSchema,
    image: z.string().min(32).max(MAX_DATA_URL_CHARS),
    caption: z.string().trim().max(gameRules.PHOTO_CAPTION_MAX_CHARS).optional(),
  }),
  xpAwarded: (output) => output.xp,
  run: async (input) => uploadBoothPhoto(input),
});
