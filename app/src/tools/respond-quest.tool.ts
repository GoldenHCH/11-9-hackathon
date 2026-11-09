import { z } from 'zod';
import { respondToQuest } from '../quests/respond';
import { publicQuest, publicQuestBoard } from '../profile/public-id';
import { declineReasons, questResponses } from '../types/kubequest.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const respondQuestTool = defineTool({
  name: 'respond_quest',
  description:
    'Accept, Not now (hidden for 30 minutes), Not for me (gone for good, optional reason) or Drop an accepted quest. Saying no never costs anything.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    questId: idSchema,
    response: z.enum(questResponses),
    reason: z.enum(declineReasons).optional(),
  }),
  run: async (input) => {
    const result = await respondToQuest(input);

    return { quest: publicQuest(result.quest), board: publicQuestBoard(result.board) };
  },
});
