import { z } from 'zod';
import { hybridSearch } from '../match/search';
import { publicSearch } from '../profile/public-id';
import { searchResultKinds, tracks } from '../types/kubequest.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, geoPointSchema, limitSchema } from './tool-schemas';

export const searchTool = defineTool({
  name: 'search',
  description:
    'One hybrid search (BM25 + Jina semantic, fused with RRF) over sessions, outposts, rooms, campfires and players who turned meeting on. Filters: now, near me, track, building, kinds.',
  input: z.object({
    query: z.string().trim().max(200),
    attendeeId: attendeeIdSchema.optional(),
    filters: z
      .object({
        now: z.boolean(),
        nearMe: z.boolean(),
        track: z.enum(tracks),
        building: z.string().trim().max(80),
        kinds: z.array(z.enum(searchResultKinds)).max(searchResultKinds.length),
      })
      .partial()
      .optional(),
    geo: geoPointSchema.optional(),
    limit: limitSchema(50).optional(),
  }),
  run: async (input) => publicSearch(await hybridSearch(input)),
});
