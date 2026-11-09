import { pendingMeetRequests } from '../meet/meets';
import { defineTool } from './define-tool';
import { attendeeInputSchema } from './tool-schemas';

export const pendingMeetRequestsTool = defineTool({
  name: 'pending_meet_requests',
  description:
    'Live "Let\'s meet" requests addressed to this player that are still inside their 30-second window, each with the requester\'s public card, the shared topics, a why line and secondsLeft. Poll every 3 s. A request that ran out becomes a normal offer for 30 minutes and sends a meet_offer notification.',
  input: attendeeInputSchema,
  run: async (input) => pendingMeetRequests(input.attendeeId),
});
