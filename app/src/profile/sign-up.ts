import { logger } from '../observability/logger';
import { checkInTool } from '../tools/check-in.tool';
import { questBoardTool } from '../tools/quest-board.tool';
import { isToolError } from '../tools/tool-errors';
import { IAttendee, ICheckInResult, IPlayerSettings, IQuest, ISignUpInput, ISignUpResult } from '../types/kubequest.interfaces';
import { levelDefinitionForXp } from '../xp/levels';
import { awardXp } from '../xp/award';
import { buildProfileText, createAttendee, getAttendee, patchAttendee } from './attendees';
import { faceSeedFor } from './face';
import { importGithubProfile } from './github';
import { claimHandle, releaseHandle, releaseQuietly } from './handles';
import { defaultSettings } from './profile.constants';
import { buildOwnProfile, personalLinkFor, withdrawOpenMeets } from './profile';
import { hasCompletedProfile, newAttendeeId } from './sign-in';
import { normalizeTopics, starterMaterialFor, suggestTopics } from './topics';

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function optional<T>(label: string, run: () => Promise<T>): Promise<T | undefined> {
  try {
    return await run();
  } catch (error) {
    if (!isToolError(error) || error.status !== 501) {
      logger.warn({ step: label, err: describe(error) }, 'sign up step skipped');
    }

    return undefined;
  }
}

interface IProfileDraft {
  handle: string;
  topics: string[];
  firstTimer: boolean;
  welcomer: boolean;
  realName?: string;
  githubLogin?: string;
  avatarUrl?: string;
  headline?: string;
  languages: string[];
}

async function draftProfile(input: ISignUpInput, handle: string, fallbackRealName?: string): Promise<IProfileDraft> {
  const github = input.githubLogin ? await importGithubProfile(input.githubLogin) : undefined;
  const languages = github?.languages ?? [];
  const topics = input.topics && input.topics.length > 0 ? normalizeTopics(input.topics) : await suggestTopics(input.workingOn, languages);
  const firstTimer = input.firstKubeCon;

  return {
    handle,
    topics,
    firstTimer,
    welcomer: !firstTimer && input.happyToWelcome === true,
    realName: input.realName ?? github?.name ?? fallbackRealName,
    githubLogin: github?.login ?? input.githubLogin,
    avatarUrl: github?.avatarUrl,
    headline: github?.bio,
    languages,
  };
}

function profileFields(input: ISignUpInput, draft: IProfileDraft, baseSettings: IPlayerSettings): Partial<IAttendee> {
  return {
    handle: draft.handle,
    faceSeed: faceSeedFor(draft.handle),
    realName: draft.realName,
    githubLogin: draft.githubLogin,
    avatarUrl: draft.avatarUrl,
    photoUrl: input.meetingOn ? draft.avatarUrl : undefined,
    spotMe: input.meetingOn ? input.spotMe : undefined,
    workingOn: input.workingOn,
    headline: draft.headline,
    profileText: buildProfileText({
      handle: draft.handle,
      workingOn: input.workingOn,
      topics: draft.topics,
      firstTimer: draft.firstTimer,
      welcomer: draft.welcomer,
      languages: draft.languages,
      bio: draft.headline,
    }),
    profile: { topics: draft.topics, firstTimer: draft.firstTimer, welcomer: draft.welcomer },
    settings: {
      ...baseSettings,
      meetingOn: input.meetingOn,
      accessibleMode: input.accessibleMode ?? baseSettings.accessibleMode,
      noWalking: input.noWalking ?? baseSettings.noWalking,
    },
  };
}

async function createPlayer(input: ISignUpInput): Promise<{ attendee: IAttendee; awardStarter: boolean }> {
  const handle = (input.handle ?? '').trim().toLowerCase();
  const attendeeId = newAttendeeId();
  await claimHandle(handle, attendeeId);

  try {
    const attendee = await buildNewPlayer(input, handle, attendeeId);
    await createAttendee(attendee);

    return { attendee, awardStarter: true };
  } catch (error) {
    await releaseQuietly(handle, attendeeId);
    throw error;
  }
}

async function buildNewPlayer(input: ISignUpInput, handle: string, attendeeId: string): Promise<IAttendee> {
  const draft = await draftProfile(input, handle);
  const fields = profileFields(input, draft, { ...defaultSettings, meetingOn: input.meetingOn });

  return {
    ...fields,
    id: attendeeId,
    handle,
    faceSeed: faceSeedFor(handle),
    workingOn: input.workingOn,
    profileText: fields.profileText ?? '',
    profile: { topics: draft.topics, firstTimer: draft.firstTimer, welcomer: draft.welcomer },
    settings: fields.settings ?? { ...defaultSettings, meetingOn: input.meetingOn },
    visible: true,
    xp: 0,
    level: levelDefinitionForXp(0).level,
    banners: [],
    blockedIds: [],
    createdAt: new Date().toISOString(),
  };
}

async function finishOnboarding(attendeeId: string, input: ISignUpInput): Promise<{ attendee: IAttendee; awardStarter: boolean }> {
  const current = await getAttendee(attendeeId);
  const requested = input.handle?.trim().toLowerCase();
  const handle = requested && requested !== current.handle ? requested : current.handle;
  const handleChanged = handle !== current.handle;

  if (handleChanged) {
    await claimHandle(handle, current.id);
  }

  let attendee: IAttendee;

  try {
    const draft = await draftProfile(input, handle, current.realName);
    const patch = profileFields(input, draft, current.settings);
    attendee = { ...current, ...patch, id: current.id };
    await patchAttendee(current.id, patch);
  } catch (error) {
    if (handleChanged) {
      await releaseQuietly(handle, current.id);
    }

    throw error;
  }

  if (handleChanged) {
    await optional('release_old_handle', () => releaseHandle(current.handle, current.id));
  }

  if (current.settings.meetingOn && !input.meetingOn) {
    await withdrawOpenMeets(current.id);
  }

  return { attendee, awardStarter: !hasCompletedProfile(current) };
}

export async function signUp(input: ISignUpInput): Promise<ISignUpResult> {
  const { attendee, awardStarter } = input.attendeeId ? await finishOnboarding(input.attendeeId, input) : await createPlayer(input);
  const starterMaterial = starterMaterialFor(attendee.profile.topics);

  if (awardStarter) {
    await optional('starter_block', () => awardXp({ attendeeId: attendee.id, type: 'badge', xp: 0, material: starterMaterial }));
  }

  let checkIn: ICheckInResult | undefined;

  if (input.scanLocationId && input.scanToken) {
    const locationId = input.scanLocationId;
    const token = input.scanToken;
    checkIn = await optional('scan_check_in', () => checkInTool.run({ attendeeId: attendee.id, locationId, token }));
  }

  const board = await optional('first_quest', () => questBoardTool.run({ attendeeId: attendee.id }));
  const firstQuest: IQuest | undefined = board?.offers[0] ?? board?.active[0];
  const fresh = (await optional('reload', () => getAttendee(attendee.id))) ?? attendee;
  const profile = await buildOwnProfile(fresh);

  return {
    profile,
    personalLink: personalLinkFor(attendee.id),
    starterMaterial,
    xpAwarded: checkIn?.xpAwarded ?? 0,
    firstQuest,
    checkIn,
  };
}
