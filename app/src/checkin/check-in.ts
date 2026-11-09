import { trace } from '@opentelemetry/api';
import { appConfig } from '../config';
import { recommendPeopleFor } from '../match/people';
import { recordArrival } from '../meet/arrivals';
import { logger } from '../observability/logger';
import { kubequestMetrics } from '../observability/metrics';
import { completeQuestsFor } from '../quests/complete';
import { verifyLocationToken } from '../security/tokens';
import { worldNow } from '../world/clock';
import { ToolError } from '../tools/tool-errors';
import { IAwardXpInput } from '../types/internal.interfaces';
import {
  IAttendee,
  IBannerProgress,
  ICheckInInput,
  ICheckInResult,
  IGeoPoint,
  ILocation,
  IPersonMatch,
  IQuest,
  ITalk,
  IXpEvent,
} from '../types/kubequest.interfaces';
import { xpRewards } from '../types/kubequest.constants';
import { CheckInRejection, CheckInStatus } from '../types/kubequest.types';
import { awardXpDetailed } from '../xp/award';
import { evaluateBanners } from '../xp/banners';
import { leveledUp, levelProgress } from '../xp/levels';
import {
  countOutpostsToday,
  findAttendee,
  findLocation,
  findRecentCheckIn,
  findRunningSession,
  recordLastLocation,
} from './lookups';

const ATTEND_XP = 10;
const OUTPOST_XP = 10;
const OUTPOSTS_PER_DAY = 5;
const WRONG_BUILDING_METERS = 400;
const EARTH_RADIUS_METERS = 6371000;
const PEOPLE_HERE_LIMIT = 3;

const tokenMessages: Record<'missing_token' | 'bad_signature' | 'expired_token', string> = {
  missing_token: "That link is missing its code. Scan the one on the room's door.",
  bad_signature: "That code isn't valid. Scan the one on the room's door.",
  expired_token: "That code isn't valid any more. Scan the one on the room's door.",
};

function recordOutcome(location: ILocation | undefined, status: CheckInStatus, xp: number, reason?: CheckInRejection): void {
  const span = trace.getActiveSpan();
  span?.setAttribute('kubequest.xp.awarded', xp);
  span?.setAttribute('kubequest.checkin.status', status);

  if (location) {
    span?.setAttribute('kubequest.location.id', location.id);
    span?.setAttribute('kubequest.location.kind', location.kind);
  }

  if (reason) {
    span?.setAttribute('kubequest.checkin.rejected_reason', reason);
  }

  kubequestMetrics().checkIns.add(1, {
    'kubequest.location.kind': location?.kind ?? 'unknown',
    'kubequest.checkin.status': status,
    'kubequest.checkin.rejected_reason': reason ?? 'none',
  });
}

async function optional<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    logger.warn({ err: error, step: label }, 'check-in side step skipped');

    return fallback;
  }
}

function distanceMeters(from: IGeoPoint, to: IGeoPoint): number {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
}

function rejected(location: ILocation, reason: CheckInRejection, message: string, talkNow?: ITalk): ICheckInResult {
  recordOutcome(location, 'rejected', 0, reason);

  return { status: 'rejected', message, xpAwarded: 0, rejectedReason: reason, location, talkNow, quizAvailable: false, completedQuests: [], newBanners: [] };
}

async function rewardFollowUps(
  attendee: IAttendee,
  event: IXpEvent,
): Promise<{ completedQuests: IQuest[]; newBanners: IBannerProgress[] }> {
  const completedQuests = await optional('complete_quests', () => completeQuestsFor(event), []);
  const banners = await optional('evaluate_banners', () => evaluateBanners(attendee.id), []);
  const newBanners = banners.filter((banner) => banner.earned && !attendee.banners.includes(banner.id));

  return { completedQuests, newBanners };
}

async function award(
  attendee: IAttendee,
  location: ILocation,
  input: IAwardXpInput,
  message: string,
  talkNow?: ITalk,
): Promise<ICheckInResult> {
  const outcome = await awardXpDetailed(input);
  const event = outcome.event;
  const followUps = await rewardFollowUps(attendee, event);
  const completedQuests = [...outcome.completedQuests, ...followUps.completedQuests];
  const newBanners = followUps.newBanners;
  const xpBefore = attendee.xp ?? 0;
  const xpAfter = xpBefore + event.xp;
  recordOutcome(location, 'awarded', event.xp);

  return {
    status: 'awarded',
    message,
    xpAwarded: event.xp,
    material: event.material,
    gemsAwarded: event.gems,
    location,
    talkNow,
    event,
    quizAvailable: talkNow !== undefined,
    completedQuests,
    levelUp: leveledUp(xpBefore, xpAfter) ? levelProgress(xpAfter) : undefined,
    newBanners,
  };
}

async function campfireCheckIn(attendee: IAttendee, location: ILocation): Promise<ICheckInResult> {
  const intros = await optional('record_arrival', () => recordArrival(attendee.id, location.id), []);
  const metIntros = intros.filter((intro) => intro.status === 'met');
  const met = metIntros.length > 0;
  const xpAwarded = metIntros.reduce((sum, intro) => sum + xpRewards.MEET + (intro.firstTimerPair ? xpRewards.MEET_FIRST_TIMER_BONUS : 0), 0);
  const banners = met ? await optional('evaluate_banners', () => evaluateBanners(attendee.id), []) : [];
  const newBanners = banners.filter((banner) => banner.earned && !attendee.banners.includes(banner.id));
  recordOutcome(location, 'awarded', xpAwarded);

  return {
    status: 'awarded',
    message: met
      ? `You both made it to ${location.name}. Say hi!`
      : intros.length > 0
        ? `You're at ${location.name}. Hold up your match signal and look for the same screen.`
        : `You're at ${location.name}. Meets happen here once both players accept.`,
    xpAwarded,
    ...(met ? { gemsAwarded: metIntros.length } : {}),
    location,
    quizAvailable: false,
    completedQuests: [],
    newBanners,
  };
}

async function outpostCheckIn(attendee: IAttendee, location: ILocation): Promise<ICheckInResult> {
  const visitedToday = await countOutpostsToday(attendee.id, appConfig.conferenceTimeZone);

  if (visitedToday >= OUTPOSTS_PER_DAY) {
    return rejected(location, 'daily_cap', `You've visited ${OUTPOSTS_PER_DAY} outposts today, the daily limit. Come back tomorrow for more.`);
  }

  const ask = location.askAbout ? ` Ask them about ${location.askAbout}.` : '';

  return award(attendee, location, { attendeeId: attendee.id, type: 'outpost', xp: OUTPOST_XP, locationId: location.id }, `+${OUTPOST_XP} XP at ${location.name}.${ask}`);
}

async function sessionCheckIn(attendee: IAttendee, location: ILocation, now: Date): Promise<ICheckInResult> {
  const talk = await findRunningSession(location.id, now);

  if (!talk) {
    return rejected(location, 'outside_session', `Nothing is running in ${location.name} right now. Scan again while a session is on to earn XP.`);
  }

  return award(
    attendee,
    location,
    { attendeeId: attendee.id, type: 'check_in', xp: ATTEND_XP, material: talk.material, talkId: talk.id, locationId: location.id },
    `+${ATTEND_XP} XP and 1 ${talk.material} block for "${talk.title}".`,
    talk,
  );
}

async function findPeopleHere(attendeeId: string): Promise<IPersonMatch[]> {
  return optional('people_here', () => recommendPeopleFor(attendeeId, { hereOnly: true, limit: PEOPLE_HERE_LIMIT }), []);
}

async function scanResult(attendee: IAttendee, location: ILocation, now: Date): Promise<ICheckInResult> {
  const recent = await findRecentCheckIn(attendee.id, location.id);

  if (recent) {
    recordOutcome(location, 'repeat', 0);

    return {
      status: 'repeat',
      message: `You already checked in at ${location.name} this hour. No extra XP, but you're all set.`,
      xpAwarded: 0,
      material: recent.material,
      location,
      event: recent,
      quizAvailable: recent.talkId !== undefined,
      completedQuests: [],
      newBanners: [],
    };
  }

  if (location.kind === 'outpost') {
    return outpostCheckIn(attendee, location);
  }

  return sessionCheckIn(attendee, location, now);
}

export async function runCheckIn(input: ICheckInInput): Promise<ICheckInResult> {
  const now = worldNow();
  const tokenCheck = verifyLocationToken(input.locationId, input.token, new Date());

  if (!tokenCheck.valid) {
    const reason = tokenCheck.reason ?? 'bad_signature';
    recordOutcome(undefined, 'rejected', 0, reason);
    trace.getActiveSpan()?.setAttribute('kubequest.location.id', input.locationId);
    throw new ToolError(403, reason, tokenMessages[reason]);
  }

  const location = await findLocation(input.locationId);

  if (!location) {
    recordOutcome(undefined, 'rejected', 0, 'unknown_location');
    throw new ToolError(404, 'unknown_location', "We don't know that place. Scan the code on the room's door.");
  }

  const attendee = await findAttendee(input.attendeeId);

  if (!attendee) {
    recordOutcome(location, 'rejected', 0, 'unknown_attendee');
    throw new ToolError(404, 'unknown_attendee', 'Sign up first, then scan the code again.');
  }

  if (input.geo && attendee.settings?.locationOn && location.geo && distanceMeters(input.geo, location.geo) > WRONG_BUILDING_METERS) {
    return rejected(location, 'wrong_building', `Your phone says you're in the other building. Scan the code at ${location.name} once you're there.`);
  }

  const located = await optional(
    'record_last_location',
    () => recordLastLocation(attendee.id, location, now).then(() => true),
    false,
  );

  if (location.kind === 'campfire') {
    return campfireCheckIn(attendee, location);
  }

  const result = await scanResult(attendee, location, now);

  if (result.status === 'rejected') {
    return result;
  }

  if (!located || !attendee.settings?.meetingOn) {
    trace.getActiveSpan()?.setAttribute('kubequest.checkin.people_here', 0);

    return result;
  }

  const peopleHere = await findPeopleHere(attendee.id);
  trace.getActiveSpan()?.setAttribute('kubequest.checkin.people_here', peopleHere.length);

  return { ...result, peopleHere };
}
