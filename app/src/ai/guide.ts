import { Span, SpanStatusCode } from '@opentelemetry/api';
import { z } from 'zod';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { getAttendee, getLocations, locationWalkPoint, minutesUntil, talkSourceExcludes, walkToTalk } from '../match/match-data';
import { recommendTalksFor } from '../match/talks';
import { logger } from '../observability/logger';
import { tracer } from '../observability/tracing';
import { IAttendee, IGuideAnswer, ITalk, ITalkMatch } from '../types/kubequest.interfaces';
import { converseWithAgentDetailed, isAgentConfigured, kubequestTools } from './agent-builder';
import { extractJson, sanitizeForPrompt } from './client';

interface IAgentPicks {
  picks: { talkId: string; why: string }[];
  toolCalls: string[];
}

const guideSettings = {
  WAIT_MS: 10000,
  AGENT_TIMEOUT_MS: 30000,
  CACHE_TTL_MS: 10 * 60 * 1000,
  CACHE_MAX_ENTRIES: 200,
  MAX_PICKS: 3,
  MAX_INTEREST_CHARS: 160,
} as const;

const answerSchema = z.object({
  picks: z.array(z.object({ talkId: z.string().min(1).max(160), why: z.string().min(1).max(240) })).max(6),
});

const settled = new Map<string, { value: IAgentPicks; expiresAt: number }>();
const inflight = new Map<string, Promise<IAgentPicks | undefined>>();

function interestFor(me: IAttendee): string {
  const topics = (me.profile?.topics ?? []).join(', ');
  const text = [topics, me.workingOn ?? me.headline ?? ''].filter((part) => part.trim() !== '').join('. ');

  return sanitizeForPrompt(text.replace(/["\\]/g, ' '), guideSettings.MAX_INTEREST_CHARS) || 'cloud native Kubernetes';
}

function guidePrompt(interest: string, afterIso: string): string {
  return [
    `Call ${kubequestTools.UPCOMING_TALKS} once with after="${afterIso}" and interest="${interest}".`,
    `Then pick up to ${guideSettings.MAX_PICKS} of the returned talks for this attendee.`,
    '<data>',
    interest,
    '</data>',
    'Reply with JSON only: {"picks":[{"talkId":"<exact id from the tool>","why":"one sentence, max 120 chars"}]}',
  ].join('\n');
}

function readSettled(key: string): IAgentPicks | undefined {
  const entry = settled.get(key);

  if (!entry || entry.expiresAt < Date.now()) {
    settled.delete(key);

    return undefined;
  }

  return entry.value;
}

function remember(key: string, value: IAgentPicks): void {
  if (settled.size >= guideSettings.CACHE_MAX_ENTRIES) {
    const oldest = settled.keys().next().value;

    if (oldest !== undefined) {
      settled.delete(oldest);
    }
  }

  settled.set(key, { value, expiresAt: Date.now() + guideSettings.CACHE_TTL_MS });
}

async function askAgentForPicks(key: string, prompt: string): Promise<IAgentPicks | undefined> {
  try {
    const reply = await converseWithAgentDetailed(prompt, undefined, guideSettings.AGENT_TIMEOUT_MS);
    const parsed = answerSchema.safeParse(extractJson(reply.message));

    if (!parsed.success) {
      logger.warn({ key }, 'guide agent reply was not valid picks JSON');

      return undefined;
    }

    const value = { picks: parsed.data.picks, toolCalls: reply.toolCalls.map((call) => call.toolId) };
    remember(key, value);

    return value;
  } catch (error) {
    logger.warn({ err: error, key }, 'guide agent call failed');

    return undefined;
  } finally {
    inflight.delete(key);
  }
}

function startAgent(key: string, prompt: string): Promise<IAgentPicks | undefined> {
  const work = askAgentForPicks(key, prompt);
  inflight.set(key, work);

  return work;
}

function waitAtMost(ms: number): Promise<undefined> {
  return new Promise((resolve) => setTimeout(() => resolve(undefined), ms).unref());
}

async function groundedMatches(me: IAttendee, agentPicks: IAgentPicks, nowMs: number): Promise<{ matches: ITalkMatch[]; dropped: number }> {
  const ids = [...new Set(agentPicks.picks.map((pick) => pick.talkId))].slice(0, guideSettings.MAX_PICKS);
  const response = await getEsClient().mget<ITalk>({ index: indexNames.TALKS, ids, _source_excludes: talkSourceExcludes }, esOptions(esTimeouts.DEFAULT_MS));
  const talks = new Map<string, ITalk>();

  for (const doc of response.docs) {
    if ('found' in doc && doc.found && doc._source && Date.parse(doc._source.end) >= nowMs) {
      talks.set(doc._id, { ...doc._source, id: doc._id });
    }
  }

  const locations = await getLocations([...[...talks.values()].map((talk) => talk.locationId), me.lastLocationId ?? '']);
  const from = locationWalkPoint(me.lastLocationId ? locations.get(me.lastLocationId) : undefined);
  const matches = ids.flatMap((id): ITalkMatch[] => {
    const talk = talks.get(id);
    const why = agentPicks.picks.find((pick) => pick.talkId === id)?.why ?? '';

    return talk
      ? [{ talk, location: locations.get(talk.locationId), score: 1, reason: why.slice(0, 160), startsInMinutes: minutesUntil(talk.start, nowMs), walkMinutes: walkToTalk(from, talk) }]
      : [];
  });

  return { matches, dropped: agentPicks.picks.length - matches.length };
}

async function answer(attendeeId: string, span: Span): Promise<IGuideAnswer> {
  const nowMs = Date.now();
  const me = await getAttendee(attendeeId);
  const interest = interestFor(me);
  const key = `${attendeeId}:${interest}`;
  let agentPicks = readSettled(key);

  span.setAttributes({ 'kubequest.guide.cache_hit': agentPicks !== undefined, 'kubequest.guide.interest_chars': interest.length });

  if (!agentPicks && isAgentConfigured()) {
    const work = inflight.get(key) ?? startAgent(key, guidePrompt(interest, new Date(nowMs).toISOString()));
    agentPicks = await Promise.race([work, waitAtMost(guideSettings.WAIT_MS)]);
  }

  if (agentPicks) {
    const { matches, dropped } = await groundedMatches(me, agentPicks, nowMs);
    span.setAttributes({ 'kubequest.guide.tool_calls': agentPicks.toolCalls.join(','), 'kubequest.guide.dropped': dropped });

    if (matches.length > 0) {
      return { provider: 'agent_builder', pending: false, interest, picks: matches, toolCalls: agentPicks.toolCalls, droppedPicks: dropped };
    }
  }

  const picks = await recommendTalksFor(attendeeId, { limit: guideSettings.MAX_PICKS });

  return { provider: 'fallback', pending: inflight.has(key), interest, picks, toolCalls: [], droppedPicks: 0 };
}

export async function askGuideWhatNext(attendeeId: string): Promise<IGuideAnswer> {
  return tracer.startActiveSpan('ai.guide_next', async (span) => {
    try {
      const result = await answer(attendeeId, span);
      span.setAttributes({ 'kubequest.ai.provider': result.provider, 'kubequest.guide.pending': result.pending, 'kubequest.guide.picks': result.picks.length });

      return result;
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
