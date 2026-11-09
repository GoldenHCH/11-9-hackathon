import { z } from 'zod';
import { makeQuest } from '../quests/make';
import { publicQuest } from '../profile/public-id';
import { questTargetKinds } from '../types/kubequest.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const makeQuestTool = defineTool({
  name: 'make_quest',
  description:
    'Turn a session or outpost from Search into an accepted quest ("Make this a quest").',
  input: z.object({
    attendeeId: attendeeIdSchema,
    targetKind: z.enum(questTargetKinds),
    targetId: idSchema,
  }),
  run: async (input) => publicQuest(await makeQuest(input)),
});
