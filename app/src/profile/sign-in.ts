import { randomBytes, randomInt } from 'node:crypto';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { ToolError } from '../tools/tool-errors';
import { IAttendee, ISignInInput, ISignInResult } from '../types/kubequest.interfaces';
import { levelDefinitionForXp } from '../xp/levels';
import { createAttendee, findAttendee } from './attendees';
import { faceSeedFor } from './face';
import { releaseQuietly, reserveHandle } from './handles';
import { defaultSettings } from './profile.constants';
import { buildOwnProfile, personalLinkFor } from './profile';

const handleRules = {
  MIN: 3,
  BASE_MAX: 15,
  FALLBACK: 'player',
  ATTEMPTS: 12,
  SUFFIX_MIN: 10,
  SUFFIX_MAX: 10000,
} as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function newAttendeeId(): string {
  return `p_${randomBytes(12).toString('base64url')}`;
}

export function baseHandleFor(name: string): string {
  const cleaned = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, handleRules.BASE_MAX);

  return cleaned.length >= handleRules.MIN ? cleaned : `${handleRules.FALLBACK}${cleaned}`.slice(0, handleRules.BASE_MAX);
}

export async function uniqueHandleFor(name: string, attendeeId: string): Promise<string> {
  const base = baseHandleFor(name);

  if (await reserveHandle(base, attendeeId)) {
    return base;
  }

  for (let attempt = 0; attempt < handleRules.ATTEMPTS; attempt += 1) {
    const candidate = `${base}${randomInt(handleRules.SUFFIX_MIN, handleRules.SUFFIX_MAX)}`;

    if (await reserveHandle(candidate, attendeeId)) {
      return candidate;
    }
  }

  throw new ToolError(409, 'handle_taken', 'We could not pick a free handle for that name. Try a slightly different name.');
}

export async function findAttendeeByEmail(email: string): Promise<IAttendee | undefined> {
  const response = await getEsClient().search(
    { index: indexNames.ATTENDEES, size: 1, query: { term: { email } }, sort: [{ createdAt: 'asc' }], _source: false },
    esOptions(esTimeouts.SEARCH_MS),
  );
  const attendeeId = response.hits.hits[0]?._id;

  return attendeeId ? findAttendee(attendeeId) : undefined;
}

export function hasCompletedProfile(attendee: IAttendee): boolean {
  return (attendee.workingOn ?? '').trim() !== '' || (attendee.profile?.topics ?? []).length > 0;
}

export async function createSignInAttendee(name: string, email: string): Promise<IAttendee> {
  const attendeeId = newAttendeeId();
  const handle = await uniqueHandleFor(name, attendeeId);
  const attendee: IAttendee = {
    id: attendeeId,
    handle,
    faceSeed: faceSeedFor(handle),
    displayName: name,
    email,
    workingOn: '',
    profileText: `${handle} is at KubeCon.`,
    profile: { topics: [], firstTimer: false, welcomer: false },
    settings: { ...defaultSettings, meetingOn: false },
    visible: true,
    xp: 0,
    level: levelDefinitionForXp(0).level,
    banners: [],
    blockedIds: [],
    createdAt: new Date().toISOString(),
  };

  try {
    await createAttendee(attendee);
  } catch (error) {
    await releaseQuietly(handle, attendeeId);
    throw error;
  }

  return attendee;
}

export async function signIn(input: ISignInInput): Promise<ISignInResult> {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  const existing = await findAttendeeByEmail(email);
  const attendee = existing ?? (await createSignInAttendee(name, email));
  const profile = await buildOwnProfile(attendee);

  return {
    attendee: profile,
    personalLink: personalLinkFor(attendee.id),
    isNew: existing === undefined,
    needsOnboarding: existing === undefined || !hasCompletedProfile(attendee),
  };
}
