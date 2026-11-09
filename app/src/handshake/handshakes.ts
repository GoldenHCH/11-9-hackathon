import { trace } from '@opentelemetry/api';
import { getEsClient, esOptions } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { completeMeetByHandshake } from '../meet/arrivals';
import { getAttendee, isConflict, pairKeyFor } from '../meet/meet.store';
import { sharedTopicsFor, toMatchPlayer } from '../meet/meets';
import { logger } from '../observability/logger';
import { kubequestMetrics } from '../observability/metrics';
import { publicIdFor, resolvePlayerId } from '../profile/public-id';
import { buildHandshakeUrl, signHandshakeToken, verifyHandshakeToken } from '../security/tokens';
import { ToolError } from '../tools/tool-errors';
import { gameRules, xpRewards } from '../types/kubequest.constants';
import { IStoredHandshake } from '../types/internal.interfaces';
import {
  IAnswerHandshakeInput,
  IAttendee,
  IHandshake,
  IHandshakeCode,
  IHandshakeStateInput,
  IHandshakeStateResult,
  IStartHandshakeInput,
} from '../types/kubequest.interfaces';
import { HandshakeRole, HandshakeStatus } from '../types/kubequest.types';
import { awardXp } from '../xp/award';
import { answersMatch } from './answer-match.helper';
import {
  countHandshakeXpSince,
  createHandshake,
  findOpenHandshake,
  findOpenPairHandshake,
  getHandshake,
  handshakeIdFor,
  IVersionedHandshake,
  pairMatchedOn,
  replaceHandshake,
} from './handshake.store';
import { chooseHandshakeQuestion } from './questions';

const SECOND_MS = 1000;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const tokenMessages: Record<'missing_token' | 'bad_signature' | 'expired_token', string> = {
  missing_token: "That handshake link is missing its code. Scan the QR on the other player's phone.",
  bad_signature: "That isn't a KubeQuest handshake code. Scan the QR on the other player's phone.",
  expired_token: 'That code just refreshed. Scan the new one on their phone.',
};

interface IAnswerOutcome {
  next: IStoredHandshake;
  evaluated: boolean;
}

function effectiveStatus(handshake: IStoredHandshake, now: number = Date.now()): HandshakeStatus {
  return handshake.status === 'waiting' && Date.parse(handshake.expiresAt) < now ? 'expired' : handshake.status;
}

function roleOf(handshake: IStoredHandshake, viewerId: string): HandshakeRole {
  return handshake.askerId === viewerId ? 'asker' : 'answerer';
}

function attemptsLeft(handshake: IStoredHandshake): number {
  return Math.max(0, gameRules.HANDSHAKE_ASKER_ATTEMPTS - handshake.askerAttempts.length);
}

function xpFor(handshake: IStoredHandshake, role: HandshakeRole): number | undefined {
  return role === 'asker' ? handshake.askerXp : handshake.answererXp;
}

function matchedLine(handshake: IStoredHandshake, role: HandshakeRole, partner: IAttendee): string {
  const xp = xpFor(handshake, role) ?? 0;

  if (xp > 0) {
    return `Handshake complete! You and @${partner.handle} are connected. +${xp} XP.`;
  }

  return `Handshake complete with @${partner.handle}! You've hit ${gameRules.HANDSHAKE_XP_PER_HOUR} handshakes this hour, so this one is for fun, not XP.`;
}

function waitingLine(handshake: IStoredHandshake, role: HandshakeRole, partner: IAttendee): string {
  const retrying = handshake.askerAttempts.length > 0 && handshake.askerPending === undefined;

  if (role === 'asker') {
    if (retrying) {
      return `That didn't match. Ask @${partner.handle} again: ${attemptsLeft(handshake)} ${attemptsLeft(handshake) === 1 ? 'try' : 'tries'} left.`;
    }

    if (handshake.askerPending !== undefined) {
      return `Got it. Waiting for @${partner.handle} to lock in their answer.`;
    }

    return `Ask @${partner.handle} the question out loud, then type what you heard.`;
  }

  if (retrying) {
    return `@${partner.handle} didn't quite catch it. Say your answer again.`;
  }

  if (handshake.answererAnswer !== undefined) {
    return `Locked in. Now tell @${partner.handle} your answer.`;
  }

  return `@${partner.handle} is about to ask you something. Lock in your answer (1 to 3 words) before you say it.`;
}

function statusLine(handshake: IStoredHandshake, status: HandshakeStatus, role: HandshakeRole, partner: IAttendee): string {
  switch (status) {
    case 'waiting':
      return waitingLine(handshake, role, partner);
    case 'matched':
      return matchedLine(handshake, role, partner);
    case 'mismatched':
      return `No match this time. Find @${partner.handle} later for another try, or shake hands with someone new.`;
    case 'expired':
      return 'This handshake ran out of time. Scan a fresh code to try again.';
  }
}

export function viewHandshake(handshake: IStoredHandshake, viewerId: string, partner: IAttendee): IHandshake {
  const status = effectiveStatus(handshake);
  const role = roleOf(handshake, viewerId);
  const revealed = status !== 'waiting';
  const lastAttempt = handshake.askerAttempts[handshake.askerAttempts.length - 1];
  const askerAnswered = handshake.askerPending !== undefined || (lastAttempt !== undefined && status !== 'waiting');
  const answererAnswered = handshake.answererAnswer !== undefined;
  const myAnswer = role === 'asker' ? lastAttempt : handshake.answererAnswer;
  const theirAnswer = role === 'asker' ? handshake.answererAnswer : lastAttempt;

  return {
    id: handshake.id,
    status,
    role,
    statusLine: statusLine(handshake, status, role, partner),
    partner: toMatchPlayer(partner),
    question: role === 'asker' ? handshake.question : handshake.answererQuestion,
    questionSource: handshake.questionSource,
    ...(handshake.questionReason ? { questionReason: handshake.questionReason } : {}),
    iAnswered: role === 'asker' ? askerAnswered : answererAnswered,
    partnerAnswered: role === 'asker' ? answererAnswered : askerAnswered,
    attemptsLeft: attemptsLeft(handshake),
    expiresAt: handshake.expiresAt,
    ...(handshake.matchedAt ? { matchedAt: handshake.matchedAt } : {}),
    ...(revealed && myAnswer !== undefined ? { myAnswer } : {}),
    ...(revealed && theirAnswer !== undefined ? { theirAnswer } : {}),
    ...(xpFor(handshake, role) !== undefined ? { xpAwarded: xpFor(handshake, role) } : {}),
    ...(handshake.meetId ? { meetId: handshake.meetId } : {}),
  };
}

async function viewFor(handshake: IStoredHandshake, viewerId: string): Promise<IHandshake> {
  const partnerId = handshake.askerId === viewerId ? handshake.answererId : handshake.askerId;

  return viewHandshake(handshake, viewerId, await getAttendee(partnerId));
}

function markSpan(handshake: IStoredHandshake, viewerId: string): void {
  trace.getActiveSpan()?.setAttributes({
    'kubequest.handshake.id': handshake.id,
    'kubequest.handshake.status': effectiveStatus(handshake),
    'kubequest.handshake.role': roleOf(handshake, viewerId),
    'kubequest.handshake.question_source': handshake.questionSource,
    'kubequest.handshake.attempts': handshake.askerAttempts.length,
  });
}

function assertParty(handshake: IStoredHandshake | undefined, attendeeId: string): IStoredHandshake {
  if (!handshake || (handshake.askerId !== attendeeId && handshake.answererId !== attendeeId)) {
    throw new ToolError(404, 'unknown_handshake', 'That handshake is not yours or no longer exists.');
  }

  return handshake;
}

async function expireIfDue(stored: IVersionedHandshake): Promise<IStoredHandshake> {
  const handshake = stored.handshake;

  if (handshake.status !== 'waiting' || effectiveStatus(handshake) !== 'expired') {
    return handshake;
  }

  const expired: IStoredHandshake = { ...handshake, status: 'expired', closedAt: new Date().toISOString() };

  try {
    await replaceHandshake(stored, expired);
    kubequestMetrics().handshakeOutcomes.add(1, { 'kubequest.handshake.status': 'expired' });
  } catch (error) {
    if (!isConflict(error)) {
      throw error;
    }
  }

  return expired;
}

export async function handshakeCode(attendeeId: string): Promise<IHandshakeCode> {
  const attendee = await getAttendee(attendeeId);
  const playerId = publicIdFor(attendee.id);
  const expiresAt = new Date(Date.now() + gameRules.HANDSHAKE_CODE_SECONDS * SECOND_MS);
  const token = signHandshakeToken(playerId, expiresAt);

  return { playerId, token, scanUrl: buildHandshakeUrl(token), expiresAt: expiresAt.toISOString() };
}

function assertCanShake(asker: IAttendee, answerer: IAttendee): void {
  if (asker.blockedIds.includes(answerer.id) || answerer.blockedIds.includes(asker.id)) {
    throw new ToolError(409, 'no_match', 'No match this time.');
  }
}

export async function startHandshake(input: IStartHandshakeInput): Promise<IHandshake> {
  const now = new Date();
  const check = verifyHandshakeToken(input.token, now);

  if (!check.valid || !check.playerId || !check.nonce) {
    const reason = check.reason ?? 'bad_signature';
    trace.getActiveSpan()?.setAttribute('kubequest.handshake.rejected_reason', reason);
    throw new ToolError(403, reason, tokenMessages[reason]);
  }

  const answererId = await resolvePlayerId(check.playerId);

  if (answererId === input.attendeeId) {
    throw new ToolError(400, 'self_handshake', "That's your own code. Scan the QR on the other player's phone.");
  }

  const [asker, answerer] = await Promise.all([getAttendee(input.attendeeId), getAttendee(answererId)]);
  assertCanShake(asker, answerer);
  const handshakeId = handshakeIdFor(check.nonce);
  const used = await getHandshake(handshakeId);

  if (used) {
    if (used.handshake.askerId !== asker.id) {
      throw new ToolError(409, 'code_used', 'Someone already used that code. Ask them to show a fresh one.');
    }

    markSpan(used.handshake, asker.id);

    return viewHandshake(await expireIfDue(used), asker.id, answerer);
  }

  const pairKey = pairKeyFor(asker.id, answerer.id, now);

  if (await pairMatchedOn(pairKey)) {
    throw new ToolError(409, 'already_shook_hands', `You and @${answerer.handle} already shook hands today. Go find someone new!`);
  }

  const open = await findOpenPairHandshake(asker.id, answerer.id, now);

  if (open) {
    markSpan(open.handshake, asker.id);

    return viewHandshake(open.handshake, asker.id, answerer);
  }

  const sharedTopics = sharedTopicsFor(asker, answerer);
  const question = await chooseHandshakeQuestion(asker, answerer, sharedTopics, check.nonce);
  const handshake: IStoredHandshake = {
    id: handshakeId,
    askerId: asker.id,
    answererId: answerer.id,
    pairKey,
    nonce: check.nonce,
    status: 'waiting',
    question: question.question,
    answererQuestion: question.answererQuestion,
    questionSource: question.source,
    ...(question.reason ? { questionReason: question.reason } : {}),
    askerAttempts: [],
    sharedTopics,
    firstTimerPair: asker.profile.firstTimer || answerer.profile.firstTimer,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + gameRules.HANDSHAKE_ANSWER_MINUTES * MINUTE_MS).toISOString(),
  };

  try {
    await createHandshake(handshake);
  } catch (error) {
    if (isConflict(error)) {
      throw new ToolError(409, 'code_used', 'Someone already used that code. Ask them to show a fresh one.');
    }

    throw error;
  }

  kubequestMetrics().handshakeOutcomes.add(1, { 'kubequest.handshake.status': 'started', 'kubequest.handshake.question_source': question.source });
  markSpan(handshake, asker.id);

  return viewHandshake(handshake, asker.id, answerer);
}

export async function handshakeState(input: IHandshakeStateInput): Promise<IHandshakeStateResult> {
  const stored = input.handshakeId ? await getHandshake(input.handshakeId) : await findOpenHandshake(input.attendeeId, new Date());

  if (!stored) {
    if (input.handshakeId) {
      assertParty(undefined, input.attendeeId);
    }

    await getAttendee(input.attendeeId);

    return {};
  }

  assertParty(stored.handshake, input.attendeeId);
  const handshake = await expireIfDue(stored);
  markSpan(handshake, input.attendeeId);

  return { handshake: await viewFor(handshake, input.attendeeId) };
}

function evaluate(handshake: IStoredHandshake, heard: string, actual: string, at: string): IStoredHandshake {
  const askerAttempts = [...handshake.askerAttempts, heard];
  const base: IStoredHandshake = { ...handshake, askerAttempts };
  delete base.askerPending;

  if (answersMatch(heard, actual)) {
    return { ...base, status: 'matched', matchedAt: at, closedAt: at };
  }

  if (askerAttempts.length >= gameRules.HANDSHAKE_ASKER_ATTEMPTS) {
    return { ...base, status: 'mismatched', closedAt: at };
  }

  return base;
}

function applyAnswer(handshake: IStoredHandshake, attendeeId: string, answer: string, at: string): IAnswerOutcome {
  if (roleOf(handshake, attendeeId) === 'answerer') {
    if (handshake.answererAnswer !== undefined) {
      throw new ToolError(409, 'already_answered', 'Your answer is already locked in. Tell them what it is!');
    }

    const locked: IStoredHandshake = { ...handshake, answererAnswer: answer };

    return handshake.askerPending !== undefined
      ? { next: evaluate(locked, handshake.askerPending, answer, at), evaluated: true }
      : { next: locked, evaluated: false };
  }

  if (handshake.answererAnswer === undefined) {
    return { next: { ...handshake, askerPending: answer }, evaluated: false };
  }

  return { next: evaluate(handshake, answer, handshake.answererAnswer, at), evaluated: true };
}

async function xpAllowed(attendeeId: string, now: Date): Promise<boolean> {
  return (await countHandshakeXpSince(attendeeId, new Date(now.getTime() - HOUR_MS))) < gameRules.HANDSHAKE_XP_PER_HOUR;
}

async function withXpDecisions(handshake: IStoredHandshake, now: Date): Promise<IStoredHandshake> {
  const perPlayer = xpRewards.MEET + (handshake.firstTimerPair ? xpRewards.MEET_FIRST_TIMER_BONUS : 0);
  const [askerAllowed, answererAllowed] = await Promise.all([xpAllowed(handshake.askerId, now), xpAllowed(handshake.answererId, now)]);

  return { ...handshake, askerXp: askerAllowed ? perPlayer : 0, answererXp: answererAllowed ? perPlayer : 0 };
}

async function awardMatch(handshake: IStoredHandshake): Promise<void> {
  const introId = handshake.meetId ?? handshake.id;
  const players = [
    { attendeeId: handshake.askerId, xp: handshake.askerXp ?? 0 },
    { attendeeId: handshake.answererId, xp: handshake.answererXp ?? 0 },
  ];

  for (const player of players) {
    if (player.xp <= 0) {
      continue;
    }

    await awardXp({ attendeeId: player.attendeeId, type: 'handshake', xp: xpRewards.MEET, gems: 1, introId });

    if (handshake.firstTimerPair) {
      await awardXp({ attendeeId: player.attendeeId, type: 'welcome', xp: xpRewards.MEET_FIRST_TIMER_BONUS, introId });
    }
  }
}

async function linkMeet(handshake: IStoredHandshake): Promise<IStoredHandshake> {
  try {
    const meetId = await completeMeetByHandshake(handshake.askerId, handshake.answererId);

    if (!meetId) {
      return handshake;
    }

    await getEsClient().update(
      { index: indexNames.HANDSHAKES, id: handshake.id, doc: { meetId }, refresh: true },
      esOptions(esTimeouts.WRITE_MS),
    );

    return { ...handshake, meetId };
  } catch (error) {
    logger.warn({ err: error, handshakeId: handshake.id }, 'could not mark the meet as met after a handshake');

    return handshake;
  }
}

async function finishMatch(handshake: IStoredHandshake): Promise<IStoredHandshake> {
  const linked = await linkMeet(handshake);
  await awardMatch(linked);
  kubequestMetrics().handshakes.add(1, { 'kubequest.handshake.question_source': linked.questionSource, 'kubequest.meet.first_timer_pair': linked.firstTimerPair });

  return linked;
}

async function answerOnce(input: IAnswerHandshakeInput): Promise<IStoredHandshake> {
  const stored = await getHandshake(input.handshakeId);
  const handshake = assertParty(stored?.handshake, input.attendeeId);
  const versioned = stored as IVersionedHandshake;
  const current = await expireIfDue(versioned);

  if (current.status === 'expired') {
    throw new ToolError(409, 'handshake_closed', 'This handshake ran out of time. Scan a fresh code to try again.');
  }

  if (current.status !== 'waiting') {
    throw new ToolError(409, 'handshake_closed', 'This handshake is already finished.');
  }

  const now = new Date();
  const outcome = applyAnswer(handshake, input.attendeeId, input.answer, now.toISOString());
  const next = outcome.next.status === 'matched' ? await withXpDecisions(outcome.next, now) : outcome.next;
  await replaceHandshake(versioned, next);

  if (outcome.evaluated) {
    kubequestMetrics().handshakeOutcomes.add(1, { 'kubequest.handshake.status': next.status === 'waiting' ? 'retry' : next.status });
    trace.getActiveSpan()?.setAttribute('kubequest.handshake.matched', next.status === 'matched');
  }

  return next.status === 'matched' ? finishMatch(next) : next;
}

export async function answerHandshake(input: IAnswerHandshakeInput): Promise<IHandshake> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handshake = await answerOnce(input);
      markSpan(handshake, input.attendeeId);

      return await viewFor(handshake, input.attendeeId);
    } catch (error) {
      if (!isConflict(error) || attempt > 0) {
        throw error;
      }
    }
  }

  throw new ToolError(409, 'conflict', 'That handshake changed while we saved it. Try again.');
}
