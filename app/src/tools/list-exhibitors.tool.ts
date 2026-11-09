import { z } from 'zod';
import { exhibitorSettings } from '../exhibitors/exhibitors.constants';
import { listExhibitors } from '../exhibitors/directory';
import { exhibitorTypes, tracks } from '../types/kubequest.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, limitSchema } from './tool-schemas';

export const listExhibitorsTool = defineTool({
  name: 'list_exhibitors',
  description:
    'Booth directory: every sponsor booth and Project Pavilion kiosk, with hybrid search (BM25 + Jina semantic, fused with RRF), type/tier/zone/topic filters, facet counts, players there now and which booths the caller visited.',
  input: z.object({
    query: z.string().trim().max(exhibitorSettings.QUERY_MAX_LENGTH).optional(),
    type: z.enum(exhibitorTypes).optional(),
    tier: z.string().trim().max(60).optional(),
    zone: z.string().trim().max(80).optional(),
    topic: z.enum(tracks).optional(),
    attendeeId: attendeeIdSchema.optional(),
    limit: limitSchema(exhibitorSettings.MAX_LIMIT).optional(),
    offset: z.number().int().min(0).max(exhibitorSettings.MAX_OFFSET).optional(),
  }),
  run: async (input) => listExhibitors(input),
});
