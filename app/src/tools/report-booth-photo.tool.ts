import { z } from 'zod';
import { reportBoothPhoto } from '../photos/booth-photos';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const reportBoothPhotoTool = defineTool({
  name: 'report_booth_photo',
  description: 'Report a booth photo that shows faces, badges or anything inappropriate. Two reports from different players hide it.',
  input: z.object({ attendeeId: attendeeIdSchema, photoId: idSchema }),
  run: async (input) => reportBoothPhoto(input),
});
