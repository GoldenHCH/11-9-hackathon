import { z } from 'zod';
import { defineTool, IRegisteredTool } from '../tools/define-tool';
import { attendeeIdSchema } from '../tools/tool-schemas';
import { tracks } from '../types/kubequest.constants';
import { askAnswer } from './ask-answer';
import { ask } from './ask';
import { askResultKinds, askSettings } from './search.constants';
import { SearchToolName } from './search.types';

const askTool = defineTool({
  name: 'ask',
  description:
    'AI search page. One retriever:rrf hybrid search (BM25 multi_match + Jina semantic_text on searchText, summary, transcript and profileText) over talks, attendees who opted in to meeting (public fields only) and booths. Returns grouped talks, people and booths plus topIds for ask_answer.',
  input: z.object({
    query: z.string().trim().min(1).max(askSettings.QUERY_MAX_CHARS),
    attendeeId: attendeeIdSchema.optional(),
    filters: z
      .object({
        kinds: z.array(z.enum(askResultKinds)).max(askResultKinds.length),
        track: z.enum(tracks),
      })
      .partial()
      .optional(),
  }),
  run: async (input) => ask(input),
});

const askAnswerTool = defineTool({
  name: 'ask_answer',
  description:
    'A short grounded answer (3 to 5 sentences) to a search query, written by the model from up to 6 ask results (topIds) with numbered citations. Waits at most 8 seconds; if Agent Builder is still writing it returns "Top matches below." with pending true, so call again to get the answer.',
  input: z.object({
    query: z.string().trim().min(1).max(askSettings.QUERY_MAX_CHARS),
    resultIds: z.array(z.string().trim().min(1).max(160)).min(1).max(askSettings.TOP_FOR_ANSWER),
  }),
  run: async (input) => askAnswer(input),
});

export const searchToolRegistry = {
  ask: askTool,
  ask_answer: askAnswerTool,
} satisfies { [TName in SearchToolName]: IRegisteredTool<TName> };
