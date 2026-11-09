import { IAttendee, IProfile, IUpdateSettingsInput } from '../types/kubequest.interfaces';
import { buildProfileText, getAttendee, patchAttendee } from './attendees';
import { normalizeIntent } from './intent';
import { buildOwnProfile, withdrawOpenMeets } from './profile';
import { normalizeTopics } from './topics';

export async function updateSettings(input: IUpdateSettingsInput): Promise<IProfile> {
  const current = await getAttendee(input.attendeeId);
  const settings = { ...current.settings, ...input.settings };
  const topics = input.topics ? normalizeTopics(input.topics) : current.profile.topics;
  const workingOn = input.workingOn ?? current.workingOn;
  const profile = { ...current.profile, topics };
  const patch: Partial<IAttendee> = { settings, profile, workingOn };

  if (input.spotMe !== undefined) {
    patch.spotMe = input.spotMe;
  }

  if (input.realName !== undefined) {
    patch.realName = input.realName;
  }

  if (input.visible !== undefined) {
    patch.visible = input.visible;
  }

  if (input.intent !== undefined) {
    patch.intent = normalizeIntent(input.intent);
  }

  if (input.topics !== undefined || input.workingOn !== undefined) {
    patch.profileText = buildProfileText({
      handle: current.handle,
      workingOn,
      topics,
      firstTimer: current.profile.firstTimer,
      welcomer: current.profile.welcomer,
      bio: current.headline,
    });
  }

  await patchAttendee(current.id, patch);

  if (current.settings.meetingOn && settings.meetingOn === false) {
    await withdrawOpenMeets(current.id);
  }

  return buildOwnProfile({ ...current, ...patch });
}
