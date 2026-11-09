import { z } from 'zod';
import { defineTool } from './define-tool';
import { importProfile } from '../profile/profile-import';
import { attendeeIdSchema } from './tool-schemas';

export const importProfileTool = defineTool({
  name: 'import_profile',
  description:
    'Turn pasted resume or LinkedIn text into a suggested profile (headline, role, seniority, skills, topics, workingOn, offers, asks and a one-paragraph summary). Emails, phone numbers and links are stripped first. Nothing is saved: show the suggestion, let the player edit it, then send it to sign_up. At most 5 calls per player per hour. When provider is "fallback" the model is still finishing: calling again with the same text a few seconds later returns its cached answer and does not count toward the limit.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    text: z.string().max(200000).optional(),
  }),
  run: importProfile,
});
