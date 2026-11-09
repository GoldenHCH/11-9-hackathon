import { z } from 'zod';
import { adminOverview } from '../exhibitors/admin';
import { defineTool } from './define-tool';
import { isoDateSchema } from './tool-schemas';

export const adminOverviewTool = defineTool({
  name: 'admin_overview',
  description:
    'Organizer view, opened with the admin key: event KPIs from organizer_stats plus booth totals, visits by tier and zone, and every booth with its visits, completed booth quests, staff link and check-in link.',
  input: z.object({
    key: z.string().trim().max(256),
    since: isoDateSchema.optional(),
  }),
  run: async (input) => adminOverview(input),
});
