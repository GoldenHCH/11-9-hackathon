import { z } from 'zod';
import { getAttendee } from '../profile/attendees';
import { buildOwnProfile, viewProfile } from '../profile/profile';
import { resolvePlayerId } from '../profile/public-id';
import { IAttendeeInput, IProfile } from '../types/kubequest.interfaces';
import { defineTool } from './define-tool';
import { attendeeIdSchema } from './tool-schemas';

const getProfileInputSchema = z.object({
  attendeeId: attendeeIdSchema,
  targetId: attendeeIdSchema.optional(),
});

async function getProfile(input: IAttendeeInput): Promise<IProfile> {
  const { attendeeId, targetId } = getProfileInputSchema.parse(input);

  const resolvedTargetId = targetId ? await resolvePlayerId(targetId) : undefined;

  if (resolvedTargetId && resolvedTargetId !== attendeeId) {
    return viewProfile(attendeeId, resolvedTargetId);
  }

  return buildOwnProfile(await getAttendee(attendeeId));
}

export const getProfileTool = defineTool({
  name: 'get_profile',
  description:
    "The player's own profile: attendee record, level progress, inventory, banners and personal link. Pass targetId (a player's public id, pl_...) to view another player: only handle, face, level, XP and banners are public; real name, photo, topics and \"how to spot me\" appear only for a confirmed meet partner.",
  input: getProfileInputSchema,
  run: getProfile,
});
