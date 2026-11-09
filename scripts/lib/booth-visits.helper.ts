import type { IAttendee, ILocation, IXpEvent } from '../../app/src/types/kubequest.interfaces';
import type { Track } from '../../app/src/types/kubequest.types';
import { levelDefinitionForXp } from '../../app/src/xp/levels';
import {
  boothVisitRules,
  handWrittenOutpostIds,
  keywordTracks,
  tierWeights,
  visitCountOptions,
  visitCountWeights,
  visitorExpoSentences,
  visitorFocuses,
  visitorGoalSentences,
  visitorHandleAnimals,
  visitorHandlePrefixes,
  visitorRoles,
} from './booth-visits.constants';
import type { IBoothSeed, IPlannedVisit, IVisitorPlan, IVisitWindow } from './booth-visits.interfaces';
import { createPrng, hashString } from './prng.helper';
import type { IPrng } from './prng.interfaces';

const minuteMs = 60 * 1000;

export function isBoothSeedEvent(event: IXpEvent): boolean {
  return event.id.startsWith(boothVisitRules.EVENT_ID_PREFIX);
}

export function stripBoothSeed(attendees: IAttendee[], xpEvents: IXpEvent[]): { attendees: IAttendee[]; xpEvents: IXpEvent[] } {
  const boothOnly = new Set<string>();
  const otherwiseActive = new Set<string>();

  for (const event of xpEvents) {
    (isBoothSeedEvent(event) ? boothOnly : otherwiseActive).add(event.attendeeId);
  }

  const generatedIds = new Set([...boothOnly].filter((attendeeId) => !otherwiseActive.has(attendeeId)));

  return {
    attendees: attendees.filter((attendee) => !generatedIds.has(attendee.id)),
    xpEvents: xpEvents.filter((event) => !isBoothSeedEvent(event)),
  };
}

function hex(prng: IPrng, length: number): string {
  return Array.from({ length }, () => Math.floor(prng.next() * 16).toString(16)).join('');
}

function isoMinute(epochMs: number): string {
  return new Date(Math.floor(epochMs / minuteMs) * minuteMs).toISOString();
}

function tracksForTopics(topics: string[]): Set<Track> {
  return new Set(topics.flatMap((topic) => (keywordTracks[topic] ? [keywordTracks[topic]] : [])));
}

function buildHandle(prng: IPrng, usedHandles: Set<string>): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const handle = `${prng.pick(visitorHandlePrefixes)}${prng.pick(visitorHandleAnimals)}`;

    if (!usedHandles.has(handle)) {
      usedHandles.add(handle);

      return handle;
    }
  }

  throw new Error('ran out of visitor handles');
}

function buildVisitor(prng: IPrng, handle: string, anchorMs: number): { attendee: IAttendee; tracks: Set<Track> } {
  const focus = prng.pick(visitorFocuses);
  const secondFocus = prng.chance(0.45) ? prng.pick(visitorFocuses.filter((candidate) => candidate.track !== focus.track)) : undefined;
  const topics = [...new Set([...focus.topics, ...(secondFocus ? secondFocus.topics.slice(0, 2) : [])])].slice(0, 5);
  const workingOn = `${prng.pick(visitorRoles)}, ${focus.clause}.`;
  const firstTimer = prng.chance(0.28);
  const welcomer = !firstTimer && prng.chance(0.14);
  const profileText = [workingOn, prng.pick(visitorExpoSentences), prng.pick(visitorGoalSentences)].join(' ');
  const tracks = new Set<Track>([focus.track, ...(secondFocus ? [secondFocus.track] : [])]);

  return {
    tracks,
    attendee: {
      id: `att-${handle}`,
      handle,
      faceSeed: handle,
      workingOn,
      headline: workingOn,
      profileText,
      profile: { topics, firstTimer, welcomer },
      settings: {
        meetingOn: prng.chance(0.75),
        accessibleMode: false,
        noWalking: false,
        locationOn: true,
        language: 'en',
        hideFromLeaderboard: false,
      },
      visible: prng.chance(0.93),
      xp: 0,
      level: 1,
      banners: [],
      blockedIds: [],
      createdAt: isoMinute(anchorMs - prng.int(240, 900) * minuteMs),
    },
  };
}

function isClear(candidateMs: number, takenMs: number[], gapMinutes: number): boolean {
  return takenMs.every((takenAt) => Math.abs(takenAt - candidateMs) >= gapMinutes * minuteMs);
}

function pickTime(prng: IPrng, startMs: number, endMs: number, chosenMs: number[], blockedMs: number[]): number | undefined {
  const spanMinutes = Math.floor((endMs - startMs) / minuteMs);

  if (spanMinutes < 0) {
    return undefined;
  }

  for (let attempt = 0; attempt < 120; attempt++) {
    const candidateMs = startMs + prng.int(0, spanMinutes) * minuteMs;

    if (
      isClear(candidateMs, chosenMs, boothVisitRules.MIN_GAP_MINUTES) &&
      isClear(candidateMs, blockedMs, boothVisitRules.EXISTING_EVENT_CLEARANCE_MINUTES)
    ) {
      return candidateMs;
    }
  }

  return undefined;
}

function planTimes(prng: IPrng, plan: IVisitorPlan, anchorMs: number): number[] {
  const chosen: number[] = [];
  const window: IVisitWindow = plan.window;
  let latestAllowedMs = window.endMs;

  if (plan.recent) {
    const recentStartMs = anchorMs - boothVisitRules.RECENT_WINDOW_MINUTES * minuteMs;
    const latest = pickTime(prng, recentStartMs, anchorMs - 2 * minuteMs, chosen, window.blockedMs);

    if (latest !== undefined) {
      chosen.push(latest);
      latestAllowedMs = recentStartMs - boothVisitRules.MIN_GAP_MINUTES * minuteMs;
    }
  }

  while (chosen.length < plan.visitCount) {
    const next = pickTime(prng, window.startMs, latestAllowedMs, chosen, window.blockedMs);

    if (next === undefined) {
      break;
    }

    chosen.push(next);
  }

  return chosen.sort((first, second) => first - second);
}

function boothWeight(booth: ILocation, tracks: Set<Track>, handWrittenBoost: number): number {
  const tierWeight = tierWeights[booth.sponsorTier ?? ''] ?? 1;
  const affinity = (booth.topics ?? []).some((topic) => tracks.has(topic as Track)) ? boothVisitRules.TOPIC_AFFINITY : 1;
  const boost = handWrittenOutpostIds.includes(booth.id) ? handWrittenBoost : 1;

  return tierWeight * affinity * boost;
}

function pickBooths(prng: IPrng, booths: ILocation[], plan: IVisitorPlan, count: number): ILocation[] {
  const picked: ILocation[] = [];

  while (picked.length < count) {
    const isLatestRecent = plan.recent && picked.length === count - 1;
    const candidates = booths.filter((booth) => !picked.includes(booth));
    const boost = isLatestRecent ? boothVisitRules.RECENT_HAND_WRITTEN_BOOST : boothVisitRules.HAND_WRITTEN_BOOST;
    const weights = candidates.map((booth) => boothWeight(booth, plan.tracks, boost));
    picked.push(prng.weightedPick(candidates, weights));
  }

  return picked;
}

function existingVisitorPlans(prng: IPrng, attendees: IAttendee[], xpEvents: IXpEvent[], anchorMs: number): IVisitorPlan[] {
  return attendees.flatMap((attendee) => {
    const ownEvents = xpEvents.filter((event) => event.attendeeId === attendee.id);
    const outpostsSoFar = ownEvents.filter((event) => event.type === 'outpost').length;
    const room = boothVisitRules.OUTPOSTS_PER_DAY - 1 - outpostsSoFar;
    const lastSeenMs = attendee.lastSeenAt ? Date.parse(attendee.lastSeenAt) : anchorMs;
    const endMs = Math.min(lastSeenMs, anchorMs) - boothVisitRules.EXISTING_LAST_SEEN_CLEARANCE_MINUTES * minuteMs;

    if (room < 1 || !prng.chance(0.8)) {
      return [];
    }

    return [
      {
        attendee,
        tracks: tracksForTopics(attendee.profile.topics),
        visitCount: prng.int(1, Math.min(room, 3)),
        window: {
          startMs: anchorMs - boothVisitRules.DAY_WINDOW_MINUTES * minuteMs,
          endMs,
          blockedMs: ownEvents.map((event) => Date.parse(event.at)),
        },
        recent: false,
        generated: false,
      },
    ];
  });
}

function generatedVisitorPlans(prng: IPrng, attendees: IAttendee[], anchorMs: number): IVisitorPlan[] {
  const usedHandles = new Set(attendees.map((attendee) => attendee.handle));
  const recentIndexes = new Set(
    prng
      .shuffle(Array.from({ length: boothVisitRules.GENERATED_VISITORS }, (_, index) => index))
      .slice(0, boothVisitRules.RECENT_VISITORS),
  );

  return Array.from({ length: boothVisitRules.GENERATED_VISITORS }, (_, index) => {
    const { attendee, tracks } = buildVisitor(prng, buildHandle(prng, usedHandles), anchorMs);
    const recent = recentIndexes.has(index);

    if (recent) {
      attendee.visible = true;
      attendee.settings.meetingOn = true;
    }

    return {
      attendee,
      tracks,
      visitCount: prng.weightedPick(visitCountOptions, visitCountWeights),
      window: {
        startMs: Math.max(anchorMs - boothVisitRules.DAY_WINDOW_MINUTES * minuteMs, Date.parse(attendee.createdAt) + 10 * minuteMs),
        endMs: anchorMs - (boothVisitRules.RECENT_WINDOW_MINUTES + boothVisitRules.MIN_GAP_MINUTES) * minuteMs,
        blockedMs: [],
      },
      recent,
      generated: true,
    };
  });
}

function badgeEvent(prng: IPrng, attendee: IAttendee, fifthVisitMs: number, anchorMs: number): IXpEvent {
  return {
    id: `${boothVisitRules.EVENT_ID_PREFIX}badge-${attendee.handle}`,
    attendeeId: attendee.id,
    type: 'badge',
    xp: 0,
    banner: boothVisitRules.SCOUT_BANNER,
    traceId: hex(prng, 32),
    spanId: hex(prng, 16),
    at: isoMinute(Math.min(fifthVisitMs + minuteMs, anchorMs - minuteMs)),
  };
}

export function buildBoothSeed(attendees: IAttendee[], xpEvents: IXpEvent[], locations: ILocation[]): IBoothSeed {
  const prng = createPrng(hashString(boothVisitRules.SEED_KEY));
  const anchorMs = Date.parse(boothVisitRules.SEED_ANCHOR);
  const booths = locations.filter((location) => location.kind === 'outpost');
  const plans = [...existingVisitorPlans(prng, attendees, xpEvents, anchorMs), ...generatedVisitorPlans(prng, attendees, anchorMs)];
  const visits: IPlannedVisit[] = [];
  const badgeEvents: IXpEvent[] = [];
  const generatedAttendees: IAttendee[] = [];

  for (const plan of plans) {
    const times = planTimes(prng, plan, anchorMs);
    const picked = pickBooths(prng, booths, plan, times.length);
    const ownVisits = times.map((atMs, index) => ({ attendeeId: plan.attendee.id, booth: picked[index], atMs }));
    visits.push(...ownVisits);

    if (!plan.generated || ownVisits.length === 0) {
      continue;
    }

    const latest = ownVisits[ownVisits.length - 1];
    const attendee = plan.attendee;
    attendee.lastLocationId = latest.booth.id;
    attendee.lastLocation = latest.booth.geo;
    attendee.lastSeenAt = isoMinute(latest.atMs);
    attendee.xp = ownVisits.length * boothVisitRules.OUTPOST_XP;
    attendee.level = levelDefinitionForXp(attendee.xp).level;

    if (ownVisits.length >= boothVisitRules.OUTPOSTS_PER_DAY) {
      attendee.banners = [boothVisitRules.SCOUT_BANNER];
      badgeEvents.push(badgeEvent(prng, attendee, ownVisits[boothVisitRules.OUTPOSTS_PER_DAY - 1].atMs, anchorMs));
    }

    generatedAttendees.push(orderedAttendee(attendee));
  }

  const visitEvents: IXpEvent[] = visits
    .sort((first, second) => first.atMs - second.atMs || first.attendeeId.localeCompare(second.attendeeId))
    .map((visit, index) => ({
      id: `${boothVisitRules.EVENT_ID_PREFIX}${String(index + 1).padStart(3, '0')}`,
      attendeeId: visit.attendeeId,
      traceId: hex(prng, 32),
      spanId: hex(prng, 16),
      at: isoMinute(visit.atMs),
      type: 'outpost',
      xp: boothVisitRules.OUTPOST_XP,
      locationId: visit.booth.id,
    }));
  const newEvents = [...visitEvents, ...badgeEvents].sort((first, second) => Date.parse(first.at) - Date.parse(second.at) || first.id.localeCompare(second.id));

  return {
    attendees: [...attendees, ...generatedAttendees],
    xpEvents: [...xpEvents, ...newEvents],
    generatedAttendees: generatedAttendees.length,
    visits: visitEvents.length,
  };
}

function orderedAttendee(attendee: IAttendee): IAttendee {
  return {
    id: attendee.id,
    handle: attendee.handle,
    faceSeed: attendee.faceSeed,
    workingOn: attendee.workingOn,
    headline: attendee.headline,
    profileText: attendee.profileText,
    profile: attendee.profile,
    settings: attendee.settings,
    lastLocationId: attendee.lastLocationId,
    lastLocation: attendee.lastLocation,
    lastSeenAt: attendee.lastSeenAt,
    visible: attendee.visible,
    xp: attendee.xp,
    level: attendee.level,
    banners: attendee.banners,
    blockedIds: attendee.blockedIds,
    createdAt: attendee.createdAt,
  };
}
