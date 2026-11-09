import { trace } from '@opentelemetry/api';
import { chatPrompt } from '../ai/hallway';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { ToolError } from '../tools/tool-errors';
import { gameRules } from '../types/kubequest.constants';
import {
  IAttendee,
  IGeoPoint,
  IIntro,
  ILocation,
  IMatchPlayer,
  IMeet,
  IProposeMeetInput,
  IRespondMeetInput,
  IRespondMeetResult,
} from '../types/kubequest.interfaces';
import { MeetStatus } from '../types/kubequest.types';
import { levelDefinitionForXp } from '../xp/levels';
import {
  blockPlayer,
  createIntro,
  getAttendee,
  getIntro,
  getLocations,
  IStoredIntro,
  isConflict,
  meetIdFor,
  pairKeyFor,
  replaceIntro,
  searchIntros,
} from './meet.store';
import { matchSignalFor } from './signal';

const MINUTE_MS = 60_000;
const SLOT_MINUTES = 30;
const DEFAULT_TOPIC = 'Kubernetes';

function nowIso(): string {
  return new Date().toISOString();
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * MINUTE_MS).toISOString();
}

function markSpan(meetId: string, status: MeetStatus): void {
  trace.getActiveSpan()?.setAttributes({ 'kubequest.meet.id': meetId, 'kubequest.meet.status': status });
}

function effectiveStatus(intro: IIntro, now: number = Date.now()): MeetStatus {
  if ((intro.status === 'proposed' || intro.status === 'accepted') && Date.parse(intro.expiresAt) < now) {
    return 'expired';
  }

  return intro.status;
}

export function sharedTopicsFor(first: IAttendee, second: IAttendee): string[] {
  const secondTopics = new Set(second.profile.topics.map((topic) => topic.toLowerCase()));

  return first.profile.topics.filter((topic) => secondTopics.has(topic.toLowerCase())).slice(0, gameRules.MAX_TOPICS);
}

export function toMatchPlayer(attendee: IAttendee): IMatchPlayer {
  return {
    id: attendee.id,
    handle: attendee.handle,
    faceSeed: attendee.faceSeed,
    level: attendee.level,
    levelName: levelDefinitionForXp(attendee.xp).name,
    xp: attendee.xp,
    banners: attendee.banners,
    isSpeaker: attendee.isSpeaker,
    topics: attendee.profile.topics,
    workingOn: attendee.workingOn,
    firstTimer: attendee.profile.firstTimer,
  };
}

function statusLine(intro: IIntro, status: MeetStatus, viewerId: string, partner: IAttendee, campfire?: ILocation): string {
  const iAccepted = intro.acceptedBy.includes(viewerId);

  switch (status) {
    case 'proposed':
      return iAccepted
        ? `Waiting to hear back. We'll tell you if @${partner.handle} is in.`
        : `@${partner.handle} works on ${partner.workingOn.trim().replace(/[.!?]+$/, '')}. Accept to meet.`;
    case 'accepted':
      return `Meet @${partner.handle} at ${campfire?.name ?? 'the campfire'}, then open Handshake and scan each other's phone.`;
    case 'met':
      return `You met @${partner.handle}.`;
    case 'declined':
      return intro.cancelledBy === viewerId ? 'You passed on this one.' : 'No match this time.';
    case 'cancelled':
      return intro.cancelledBy === viewerId ? "You said you can't make it." : "This meet is off. Nobody loses anything.";
    case 'expired':
      return 'This offer ran out of time.';
  }
}

export function viewMeet(intro: IIntro, viewerId: string, partner: IAttendee, campfire?: ILocation, xpAwarded?: number): IMeet {
  const status = effectiveStatus(intro);
  const revealed = status === 'accepted' || status === 'met';
  const myArrival = intro.arrivals.find((arrival) => arrival.attendeeId === viewerId);

  return {
    id: intro.id,
    status,
    role: intro.fromId === viewerId ? 'proposer' : 'partner',
    statusLine: statusLine(intro, status, viewerId, partner, campfire),
    partner: toMatchPlayer(partner),
    partnerDetails: revealed ? { realName: partner.realName, photoUrl: partner.photoUrl ?? partner.avatarUrl, spotMe: partner.spotMe } : undefined,
    campfire: revealed ? campfire : undefined,
    slot: revealed ? intro.slot : undefined,
    icebreaker: revealed ? intro.icebreaker : undefined,
    chatPrompt: revealed ? intro.chatPrompt?.replace(/^Ask @\S+/i, `Ask @${partner.handle}`) : undefined,
    matchSignal: revealed ? intro.matchSignal : undefined,
    sharedTopics: intro.sharedTopics,
    iAccepted: intro.acceptedBy.includes(viewerId),
    iArrivedAt: myArrival?.at,
    partnerArrived: revealed && intro.arrivals.some((arrival) => arrival.attendeeId !== viewerId),
    expiresAt: intro.expiresAt,
    xpAwarded,
  };
}

async function viewFor(intro: IIntro, viewerId: string, xpAwarded?: number): Promise<IMeet> {
  const partnerId = intro.fromId === viewerId ? intro.toId : intro.fromId;
  const partner = await getAttendee(partnerId);
  const campfires = await getLocations(intro.campfireId ? [intro.campfireId] : []);

  return viewMeet(intro, viewerId, partner, intro.campfireId ? campfires.get(intro.campfireId) : undefined, xpAwarded);
}

function midpoint(points: IGeoPoint[]): IGeoPoint | undefined {
  if (points.length === 0) {
    return undefined;
  }

  return {
    lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
    lon: points.reduce((sum, point) => sum + point.lon, 0) / points.length,
  };
}

async function nearestCampfire(first: IAttendee, second: IAttendee): Promise<ILocation | undefined> {
  const lastRooms = await getLocations([first.lastLocationId ?? '', second.lastLocationId ?? '']);
  const firstBuilding = first.lastLocationId ? lastRooms.get(first.lastLocationId)?.building : undefined;
  const secondBuilding = second.lastLocationId ? lastRooms.get(second.lastLocationId)?.building : undefined;
  const sameBuilding = firstBuilding !== undefined && firstBuilding === secondBuilding ? firstBuilding : undefined;
  const points = [first.lastLocation ?? (first.lastLocationId ? lastRooms.get(first.lastLocationId)?.geo : undefined), second.lastLocation ?? (second.lastLocationId ? lastRooms.get(second.lastLocationId)?.geo : undefined)].filter(
    (point): point is IGeoPoint => point !== undefined,
  );
  const center = midpoint(points);
  const attempts = sameBuilding ? [sameBuilding, undefined] : [undefined];

  for (const building of attempts) {
    const response = await getEsClient().search<ILocation>(
      {
        index: indexNames.LOCATIONS,
        size: 1,
        query: { bool: { filter: [{ term: { kind: 'campfire' } }, ...(building ? [{ term: { building } }] : [])] } },
        ...(center ? { sort: [{ _geo_distance: { geo: center, order: 'asc' as const, unit: 'm' } }] } : {}),
      },
      esOptions(esTimeouts.SEARCH_MS),
    );
    const hit = response.hits.hits[0];

    if (hit?._source && hit._id) {
      return { ...hit._source, id: hit._id };
    }
  }

  return undefined;
}

async function pairPrompt(first: IAttendee, second: IAttendee, sharedTopics: string[]): Promise<string> {
  const fallback = `You both work on ${sharedTopics[0] ?? DEFAULT_TOPIC}. Ask what broke last.`;

  try {
    const result = await chatPrompt(first, second, sharedTopics);

    return result.value.trim() === '' ? fallback : result.value;
  } catch (error) {
    logger.warn({ err: error }, 'chat prompt unavailable, using fallback');

    return fallback;
  }
}

async function confirmMeet(intro: IIntro, at: string): Promise<IIntro> {
  const [first, second] = await Promise.all([getAttendee(intro.fromId), getAttendee(intro.toId)]);
  const campfire = await nearestCampfire(first, second);
  const sharedTopics = intro.sharedTopics.length > 0 ? intro.sharedTopics : sharedTopicsFor(first, second);
  const slot = { start: at, end: addMinutes(at, SLOT_MINUTES) };
  const prompt = await pairPrompt(first, second, sharedTopics);

  return {
    ...intro,
    status: 'accepted',
    respondedAt: at,
    campfireId: campfire?.id,
    slot,
    icebreaker: `You both work on ${sharedTopics[0] ?? DEFAULT_TOPIC}. Ask what broke last.`,
    chatPrompt: prompt,
    matchSignal: matchSignalFor(intro.id),
    sharedTopics,
    expiresAt: addMinutes(slot.end, gameRules.MEET_SCAN_WINDOW_MINUTES),
  };
}

async function accept(stored: IStoredIntro, attendeeId: string): Promise<IIntro> {
  const at = nowIso();
  const acceptedBy = [...new Set([...stored.intro.acceptedBy, attendeeId])];
  const accepted: IIntro = { ...stored.intro, acceptedBy };
  const next = acceptedBy.includes(accepted.fromId) && acceptedBy.includes(accepted.toId) ? await confirmMeet(accepted, at) : accepted;

  await replaceIntro(stored, next);

  return next;
}

function assertCanMeet(attendee: IAttendee, partner: IAttendee): void {
  if (!attendee.settings.meetingOn) {
    throw new ToolError(409, 'meeting_off', 'Turn on meeting in Profile to meet other players.');
  }

  if (!partner.settings.meetingOn || attendee.blockedIds.includes(partner.id) || partner.blockedIds.includes(attendee.id)) {
    throw new ToolError(409, 'no_match', 'No match this time.');
  }
}

export async function proposeMeet(input: IProposeMeetInput): Promise<IMeet> {
  const [attendee, partner] = await Promise.all([getAttendee(input.attendeeId), getAttendee(input.partnerId)]);
  assertCanMeet(attendee, partner);
  const proposedAt = nowIso();
  const pairKey = pairKeyFor(attendee.id, partner.id, new Date(proposedAt));
  const meetId = meetIdFor(pairKey);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const stored = await getIntro(meetId);

    try {
      if (!stored || effectiveStatus(stored.intro) === 'expired' || stored.intro.status === 'cancelled') {
        const intro: IIntro = {
          id: meetId,
          fromId: attendee.id,
          toId: partner.id,
          pairKey,
          status: 'proposed',
          proposedAt,
          acceptedBy: [attendee.id],
          arrivals: [],
          sharedTopics: sharedTopicsFor(attendee, partner),
          firstTimerPair: attendee.profile.firstTimer || partner.profile.firstTimer,
          expiresAt: addMinutes(proposedAt, gameRules.MEET_OFFER_MINUTES),
        };

        if (stored) {
          await replaceIntro(stored, intro);
        } else {
          await createIntro(intro);
        }

        markSpan(meetId, intro.status);

        return viewMeet(intro, attendee.id, partner);
      }

      const next = stored.intro.status === 'proposed' && !stored.intro.acceptedBy.includes(attendee.id) ? await accept(stored, attendee.id) : stored.intro;
      markSpan(meetId, effectiveStatus(next));

      return await viewFor(next, attendee.id);
    } catch (error) {
      if (!isConflict(error) || attempt > 0) {
        throw error;
      }
    }
  }

  throw new ToolError(409, 'conflict', 'That meet changed while we saved it. Try again.');
}

export async function respondMeet(input: IRespondMeetInput): Promise<IRespondMeetResult> {
  const stored = await getIntro(input.meetId);

  if (!stored || (stored.intro.fromId !== input.attendeeId && stored.intro.toId !== input.attendeeId)) {
    throw new ToolError(404, 'unknown_meet', 'That meet is not yours or no longer exists.');
  }

  const intro = stored.intro;
  const status = effectiveStatus(intro);
  const partnerId = intro.fromId === input.attendeeId ? intro.toId : intro.fromId;
  const at = nowIso();
  let next = intro;

  if (input.response === 'accept') {
    if (status !== 'proposed') {
      throw new ToolError(409, 'meet_closed', status === 'expired' ? 'This offer ran out of time.' : 'This meet can no longer be accepted.');
    }

    next = intro.acceptedBy.includes(input.attendeeId) ? intro : await accept(stored, input.attendeeId);
  } else if (input.response === 'decline') {
    if (status !== 'proposed') {
      throw new ToolError(409, 'meet_closed', 'Only an open offer can be declined.');
    }

    next = { ...intro, status: 'declined', respondedAt: at, cancelledBy: input.attendeeId };
    await replaceIntro(stored, next);
  } else {
    if (status !== 'accepted' || intro.arrivals.length > 0) {
      throw new ToolError(409, 'meet_locked', "You can back out only before the first scan of an accepted meet.");
    }

    next = { ...intro, status: 'cancelled', respondedAt: at, cancelledBy: input.attendeeId };
    await replaceIntro(stored, next);
  }

  if (input.blockPartner) {
    await blockPlayer(await getAttendee(input.attendeeId), partnerId);
  }

  markSpan(next.id, effectiveStatus(next));

  return { meet: await viewFor(next, input.attendeeId, 0), xpAwarded: 0 };
}

export async function listMeets(attendeeId: string): Promise<IMeet[]> {
  await getAttendee(attendeeId);
  const stored = await searchIntros(attendeeId);
  trace.getActiveSpan()?.setAttribute('kubequest.meet.count', stored.length);

  return Promise.all(stored.map(({ intro }) => viewFor(intro, attendeeId)));
}
