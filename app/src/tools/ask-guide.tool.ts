import { askGuideWhatNext } from '../ai/guide';
import { defineTool } from './define-tool';
import { attendeeInputSchema } from './tool-schemas';

export const askGuideTool = defineTool({
  name: 'ask_guide',
  description:
    'Ask the Elastic Agent Builder guide what to see next. The agent calls an ES|QL tool over the talks index (Jina semantic match plus Jina rerank); every talk id it returns is checked against the index. Falls back to reranked recommendations while the agent is still thinking (pending: true).',
  input: attendeeInputSchema,
  run: async (input) => askGuideWhatNext(input.attendeeId),
});
