import { randomBytes } from 'node:crypto';
import { logger } from '../observability/logger';
import { checkInTool } from '../tools/check-in.tool';
import { questBoardTool } from '../tools/quest-board.tool';
import { isToolError, ToolError } from '../tools/tool-errors';
import { IAttendee, ICheckInResult, IQuest, ISignUpInput, ISignUpResult } from '../types/kubequest.interfaces';
import { levelDefinitionForXp } from '../xp/levels';
import { awardXp } from '../xp/award';
import { buildProfileText, createAttendee, getAttendee, handleTaken } from './attendees';
import { faceSeedFor } from './face';
import { importGithubProfile } from './github';
import { defaultSettings } from './profile.constants';
import { buildOwnProfile, personalLinkFor } from './profile';
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

function newAttendeeId(): string {
  return `p_${randomBytes(12).toString('base64url')}`;
}

export async function signUp(input: ISignUpInput): Promise<ISignUpResult> {
  const handle = input.handle.trim().toLowerCase();

  if (await handleTaken(handle)) {
    throw new ToolError(409, 'handle_taken', `The handle "${handle}" is taken. Try another one.`);
  }

  const github = input.githubLogin ? await importGithubProfile(input.githubLogin) : undefined;
  const languages = github?.languages ?? [];
  const topics = input.topics && input.topics.length > 0 ? normalizeTopics(input.topics) : await suggestTopics(input.workingOn, languages);
  const firstTimer = input.firstKubeCon;
  const welcomer = !firstTimer && input.happyToWelcome === true;
  const now = new Date().toISOString();
  const realName = input.realName ?? github?.name;

  const attendee: IAttendee = {
    id: newAttendeeId(),
    handle,
    faceSeed: faceSeedFor(handle),
    realName,
    githubLogin: github?.login ?? input.githubLogin,
    avatarUrl: github?.avatarUrl,
    photoUrl: input.meetingOn ? github?.avatarUrl : undefined,
    spotMe: input.meetingOn ? input.spotMe : undefined,
    workingOn: input.workingOn,
    headline: github?.bio,
    profileText: buildProfileText({ handle, workingOn: input.workingOn, topics, firstTimer, welcomer, languages, bio: github?.bio }),
    profile: { topics, firstTimer, welcomer },
    settings: {
      ...defaultSettings,
      meetingOn: input.meetingOn,
      accessibleMode: input.accessibleMode ?? defaultSettings.accessibleMode,
      noWalking: input.noWalking ?? defaultSettings.noWalking,
    },
    visible: true,
    xp: 0,
    level: levelDefinitionForXp(0).level,
    banners: [],
    blockedIds: [],
    createdAt: now,
  };

  await createAttendee(attendee);

  const starterMaterial = starterMaterialFor(topics);
  await optional('starter_block', () => awardXp({ attendeeId: attendee.id, type: 'badge', xp: 0, material: starterMaterial }));

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
