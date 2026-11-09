import { z } from 'zod';
import { listNotifications } from '../notifications/notifications';
import { notificationRules } from '../notifications/notifications.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, limitSchema } from './tool-schemas';

export const listNotificationsTool = defineTool({
  name: 'list_notifications',
  description: 'The bell: your notifications newest first (new quests, people to meet, meet offers, banners) and how many are unread.',
  input: z.object({
    attendeeId: attendeeIdSchema,
    limit: limitSchema(notificationRules.LIST_MAX).optional(),
  }),
  run: async (input) => listNotifications(input),
});
