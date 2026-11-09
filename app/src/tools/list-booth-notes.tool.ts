import { listBoothNotes } from '../booth/booth-notes';
import { defineTool } from './define-tool';
import { attendeeInputSchema } from './tool-schemas';

export const listBoothNotesTool = defineTool({
  name: 'list_booth_notes',
  description: "The player's booth notes, newest first.",
  input: attendeeInputSchema,
  run: async (input) => listBoothNotes(input.attendeeId),
});
