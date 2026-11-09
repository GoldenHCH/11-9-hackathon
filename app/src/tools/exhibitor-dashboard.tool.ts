import { z } from 'zod';
import { exhibitorDashboard } from '../exhibitors/dashboard';
import { defineTool } from './define-tool';
import { idSchema } from './tool-schemas';

export const exhibitorDashboardTool = defineTool({
  name: 'exhibitor_dashboard',
  description:
    "Booth staff view, opened with the booth's staff key or the admin key: the check-in QR link, visits now, today and over the conference, visits by hour, visitor topics and levels, recent visitors, who is here now, the booth-quest funnel and the booth's rank.",
  input: z.object({
    outpostId: idSchema,
    key: z.string().trim().max(256),
  }),
  run: async (input) => exhibitorDashboard(input),
});
