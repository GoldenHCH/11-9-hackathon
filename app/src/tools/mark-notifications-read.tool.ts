import { z } from 'zod';
import { markNotificationsRead } from '../notifications/notifications';
import { notificationRules } from '../notifications/notifications.constants';
import { defineTool } from './define-tool';
import { attendeeIdSchema, idSchema } from './tool-schemas';

export const markNotificationsReadTool = defineTool({
  name: 'mark_notifications_read',
  description: 'Mark notifications read: pass ids from list_notifications, or all: true for every unread one.',
  input: z
    .object({
      attendeeId: attendeeIdSchema,
      ids: z.array(idSchema).max(notificationRules.LIST_MAX).optional(),
      all: z.boolean().optional(),
    })
    .refine((input) => input.all === true || (input.ids ?? []).length > 0, { message: 'pass ids or all: true' }),
  run: async (input) => markNotificationsRead(input),
});
