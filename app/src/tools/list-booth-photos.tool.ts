import { z } from 'zod';
import { listBoothPhotos } from '../photos/booth-photos';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const listBoothPhotosTool = defineTool({
  name: 'list_booth_photos',
  description:
    "Visible photos of one booth, newest first. Each has an image url, caption, and the uploader's public handle and face. Pass attendeeId to mark the player's own photos.",
  input: z.object({
    locationId: idSchema,
    attendeeId: attendeeIdSchema.optional(),
    limit: z.number().int().min(1).max(30).optional(),
  }),
  run: async (input) => listBoothPhotos(input),
});
