import type { IAttendee, IIntro, ILocation, IXpEvent } from '../../shared/src/index';
import {
  bestOverlap,
  buildXpEventId,
  nearestMeetingPoint,
  roundUpToQuarterHour,
} from './activity-generator.helper';
import { lookupTopic } from './attendee-generator.helper';
import type { IBusyInterval, ICheckInPick, IIntroBuildResult } from './data-scripts.interfaces';
import type { IPrng } from './prng.interfaces';
import { addMinutes, formatDenverIso, toEpochMs } from './time.helper';

const minuteMs = 60 * 1000;
const firstTimerIcebreakers = [
  'Ask them what they wish someone had told them before their very first KubeCon.',
  'Start with which talk surprised each of you most today, then swap hallway-track tips.',
  'Ask what they would put on a first-timer survival list for the week.',
];

function buildBusyMap(picksByAttendee: Map<string, ICheckInPick[]>): Map<string, IBusyInterval[]> {
  const busy = new Map<string, IBusyInterval[]>();
  for (const [attendeeId, picks] of picksByAttendee) {
    busy.set(
      attendeeId,
      picks.map((pick) => ({
        startMs: toEpochMs(pick.at) - 20 * minuteMs,
        endMs: toEpochMs(pick.at) + 15 * minuteMs,
      })),
    );
  }

  return busy;
}

function isFree(busy: Map<string, IBusyInterval[]>, participantIds: string[], startMs: number): boolean {
  const endMs = startMs + 30 * minuteMs;

  return participantIds.every((participantId) =>
    (busy.get(participantId) ?? []).every((interval) => endMs <= interval.startMs || startMs >= interval.endMs),
  );
}

function reserve(busy: Map<string, IBusyInterval[]>, participantIds: string[], startMs: number): void {
  for (const participantId of participantIds) {
    const intervals = busy.get(participantId) ?? [];
    intervals.push({ startMs: startMs - 5 * minuteMs, endMs: startMs + 35 * minuteMs });
    busy.set(participantId, intervals);
  }
}

function chooseSlotStart(
  prng: IPrng,
  busy: Map<string, IBusyInterval[]>,
  participantIds: string[],
  earliestMs: number,
  latestMs: number,
): number {
  let candidate = roundUpToQuarterHour(earliestMs);
  for (let attempt = 0; attempt < 40; attempt++) {
    candidate = roundUpToQuarterHour(earliestMs + prng.int(0, Math.floor((latestMs - earliestMs) / minuteMs)) * minuteMs);
    if (isFree(busy, participantIds, candidate)) {
      break;
    }
  }
  reserve(busy, participantIds, candidate);

  return candidate;
}

function icebreakerFor(from: IAttendee, to: IAttendee, prng: IPrng): string {
  if (from.profile.firstTimer || to.profile.firstTimer) {
    return prng.pick(firstTimerIcebreakers);
  }
  const sharedTopics = from.profile.topics.filter((topic) => to.profile.topics.includes(topic));
  const keyword = sharedTopics[0] ?? to.profile.topics[0];

  return lookupTopic(keyword).icebreaker;
}

export function buildIntros(
  prng: IPrng,
  generated: IAttendee[],
  picksByAttendee: Map<string, ICheckInPick[]>,
  meetingPoints: ILocation[],
  locationsById: Map<string, ILocation>,
  nowMs: number,
  counters: Map<string, number>,
): IIntroBuildResult {
  const visible = generated.filter((attendee) => attendee.visible);
  const firstTimers = visible.filter((attendee) => attendee.profile.firstTimer);
  const welcomers = visible.filter((attendee) => attendee.profile.welcomer);
  const regulars = visible.filter((attendee) => !attendee.profile.firstTimer && !attendee.profile.welcomer);
  if (firstTimers.length < 3 || welcomers.length < 2 || regulars.length < 3) {
    throw new Error('Not enough first-timers, welcomers or regular attendees to build the intro scenario');
  }

  const used = new Set<string>();
  const take = (source: IAttendee, pool: IAttendee[]): IAttendee => {
    const chosen = bestOverlap(source, pool, used);
    used.add(chosen.id);

    return chosen;
  };

  const [connectorWelcomer, secondWelcomer] = prng.shuffle(welcomers);
  used.add(connectorWelcomer.id);
  used.add(secondWelcomer.id);
  const firstTimerOne = take(connectorWelcomer, firstTimers);
  const firstTimerTwo = take(connectorWelcomer, firstTimers);
  const connector = take(connectorWelcomer, regulars);
  const regularOne = take(connector, regulars);
  const regularTwo = take(connector, regulars);
  const firstTimerThree = take(secondWelcomer, firstTimers);

  const metPairs: [IAttendee, IAttendee][] = [
    [firstTimerOne, connectorWelcomer],
    [firstTimerTwo, connectorWelcomer],
    [connector, connectorWelcomer],
    [regularOne, connector],
    [regularTwo, connector],
    [firstTimerOne, secondWelcomer],
    [firstTimerThree, secondWelcomer],
  ];

  const remaining = prng.shuffle(visible.filter((attendee) => !used.has(attendee.id)));
  const takePair = (): [IAttendee, IAttendee] => {
    const first = remaining.shift() as IAttendee;
    const second = bestOverlap(first, remaining, new Set());
    remaining.splice(remaining.indexOf(second), 1);

    return [first, second];
  };

  const plannedOthers: { pair: [IAttendee, IAttendee]; status: IIntro['status'] }[] = [
    { pair: takePair(), status: 'accepted' },
    { pair: takePair(), status: 'accepted' },
    { pair: takePair(), status: 'proposed' },
    { pair: takePair(), status: 'proposed' },
    { pair: takePair(), status: 'proposed' },
    { pair: takePair(), status: 'declined' },
    { pair: takePair(), status: 'declined' },
  ];

  const lastGeo = (attendeeId: string): ILocation['geo'] | undefined => {
    const picks = picksByAttendee.get(attendeeId) ?? [];
    const latest = picks[picks.length - 1];

    return latest ? locationsById.get(latest.session.locationId)?.geo : undefined;
  };

  const busy = buildBusyMap(picksByAttendee);
  const earliestConferenceMs = toEpochMs('2026-11-10T09:30:00');
  const earliestProposalMs = toEpochMs('2026-11-10T07:30:00');
  const drafts: IIntro[] = [];

  for (const [from, to] of metPairs) {
    const slotStartMs = chooseSlotStart(prng, busy, [from.id, to.id], earliestConferenceMs, nowMs - 45 * minuteMs);
    const slotStart = formatDenverIso(slotStartMs);
    const fromArrivalMs = slotStartMs + prng.int(0, 4) * minuteMs;
    const toArrivalMs = fromArrivalMs + prng.int(1, 14) * minuteMs;
    const fromGeo = lastGeo(from.id);
    const toGeo = lastGeo(to.id);
    drafts.push({
      id: '',
      fromId: from.id,
      toId: to.id,
      status: 'met',
      proposedAt: formatDenverIso(Math.max(slotStartMs - prng.int(30, 600) * minuteMs, earliestProposalMs)),
      slot: { start: slotStart, end: addMinutes(slotStart, 15) },
      meetingPointId: nearestMeetingPoint(meetingPoints, fromGeo, toGeo).id,
      icebreaker: icebreakerFor(from, to, prng),
      arrivals: [
        { attendeeId: from.id, at: formatDenverIso(fromArrivalMs) },
        { attendeeId: to.id, at: formatDenverIso(toArrivalMs) },
      ],
    });
  }

  for (const { pair, status } of plannedOthers) {
    const [from, to] = pair;
    const base: IIntro = {
      id: '',
      fromId: from.id,
      toId: to.id,
      status,
      proposedAt: '',
      arrivals: [],
    };
    if (status === 'accepted') {
      const slotStartMs = chooseSlotStart(prng, busy, [from.id, to.id], nowMs + 15 * minuteMs, nowMs + 120 * minuteMs);
      const slotStart = formatDenverIso(slotStartMs);
      const fromGeo = lastGeo(from.id);
      const toGeo = lastGeo(to.id);
      base.proposedAt = formatDenverIso(nowMs - prng.int(20, 180) * minuteMs);
      base.slot = { start: slotStart, end: addMinutes(slotStart, 15) };
      base.meetingPointId = nearestMeetingPoint(meetingPoints, fromGeo, toGeo).id;
      base.icebreaker = icebreakerFor(from, to, prng);
    } else if (status === 'proposed') {
      base.proposedAt = formatDenverIso(nowMs - prng.int(5, 150) * minuteMs);
    } else {
      base.proposedAt = formatDenverIso(nowMs - prng.int(60, 400) * minuteMs);
    }
    drafts.push(base);
  }

  const intros = drafts
    .sort((first, second) => toEpochMs(first.proposedAt) - toEpochMs(second.proposedAt) || first.fromId.localeCompare(second.fromId))
    .map((intro, index) => ({ ...intro, id: `intro-${String(index + 1).padStart(3, '0')}` }));

  const attendeesById = new Map(generated.map((attendee) => [attendee.id, attendee]));
  const handshakeEvents: IXpEvent[] = [];
  for (const intro of intros.filter((candidate) => candidate.status === 'met')) {
    const handshakeAt = intro.arrivals[1].at;
    const participants = [attendeesById.get(intro.fromId) as IAttendee, attendeesById.get(intro.toId) as IAttendee];
    for (const participant of participants) {
      handshakeEvents.push({
        id: buildXpEventId(participant.id, 'handshake', counters),
        attendeeId: participant.id,
        type: 'handshake',
        xp: 50,
        locationId: intro.meetingPointId,
        introId: intro.id,
        at: handshakeAt,
      });
    }
    const [first, second] = participants;
    if (first.profile.firstTimer !== second.profile.firstTimer) {
      const welcoming = first.profile.firstTimer ? second : first;
      handshakeEvents.push({
        id: buildXpEventId(welcoming.id, 'welcome', counters),
        attendeeId: welcoming.id,
        type: 'welcome',
        xp: 25,
        locationId: intro.meetingPointId,
        introId: intro.id,
        at: handshakeAt,
      });
    }
  }

  return { intros, handshakeEvents };
}
