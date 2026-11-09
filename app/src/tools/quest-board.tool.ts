import { defineTool } from './define-tool';
import { buildBoard } from '../quests/board';
import { publicQuestBoard } from '../profile/public-id';
import { attendeeInputSchema } from './tool-schemas';

export const questBoardTool = defineTool({
  name: 'quest_board',
  description:
    'The Quests tab: up to three offers, up to three active quests and the ones done today. Offers refresh after every check-in.',
  input: attendeeInputSchema,
  run: async (input) => publicQuestBoard(await buildBoard(input.attendeeId)),
});
