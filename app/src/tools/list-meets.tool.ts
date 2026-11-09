import { listMeets } from '../meet/meets';
import { publicMeet } from '../profile/public-id';
import { defineTool } from './define-tool';
import { attendeeInputSchema } from './tool-schemas';

export const listMeetsTool = defineTool({
  name: 'list_meets',
  description:
    "The player's meets in every status, each projected for the viewer: partner details, campfire, time, opening line and match signal appear only after both accepted.",
  input: attendeeInputSchema,
  run: async (input) => (await listMeets(input.attendeeId)).map(publicMeet),
});
