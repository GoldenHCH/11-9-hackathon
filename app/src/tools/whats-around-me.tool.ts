import { defineTool } from './define-tool';
import { whatsAroundMe } from '../match/around';
import { publicAround } from '../profile/public-id';
import { attendeeInputSchema } from './tool-schemas';

export const whatsAroundMeTool = defineTool({
  name: 'whats_around_me',
  description:
    'The room the player last scanned: the session on now and next, how many players are here, whether a quiz or boss fight is open, and the nearest campfire.',
  input: attendeeInputSchema,
  run: async (input) => publicAround(await whatsAroundMe(input.attendeeId)),
});
