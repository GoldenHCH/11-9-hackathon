import { z } from 'zod';
import { deleteBoothPhoto } from '../photos/booth-photos';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const deleteBoothPhotoTool = defineTool({
  name: 'delete_booth_photo',
  description: "Delete one of the player's own booth photos.",
  input: z.object({ attendeeId: attendeeIdSchema, photoId: idSchema }),
  run: async (input) => deleteBoothPhoto(input),
});
