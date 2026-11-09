import { createHash } from 'node:crypto';
import { Span, SpanStatusCode } from '@opentelemetry/api';
import { getEsClient, isElasticConfigured } from '../es/client';
import { logger } from '../observability/logger';
import { tracer } from '../observability/tracing';
import { IAiResult, IJsonValidator } from '../types/internal.interfaces';
import { AiProvider, AiPurpose } from '../types/kubequest.types';
import { converseWithAgent, isAgentConfigured } from './agent-builder';
import { aiSettings, systemPreamble } from './prompts.constants';

interface ICacheEntry {
  value: unknown;
  provider: AiProvider;
  expiresAt: number;
}

interface IModelAnswer {
  text: string;
  provider: AiProvider;
}

const cache = new Map<string, ICacheEntry>();
const inferenceBlockedUntil = new Map<string, number>();
let agentBlockedUntil = 0;

function cacheKey(purpose: AiPurpose, prompt: string): string {
  return `${purpose}:${createHash('sha256').update(prompt).digest('hex')}`;
}

function readCache(key: string): ICacheEntry | undefined {
  const entry = cache.get(key);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt < Date.now()) {
    cache.delete(key);

    return undefined;
  }

  return entry;
}

function writeCache(key: string, value: unknown, provider: AiProvider): void {
  if (cache.size >= aiSettings.CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;

    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }

  cache.set(key, { value, provider, expiresAt: Date.now() + aiSettings.CACHE_TTL_MS });
}

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  if ('meta' in error && typeof error.meta === 'object' && error.meta !== null && 'statusCode' in error.meta && typeof error.meta.statusCode === 'number') {
    return error.meta.statusCode;
  }

  if ('status' in error && typeof error.status === 'number') {
    return error.status;
  }

  return undefined;
}

function errorReason(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'meta' in error && typeof error.meta === 'object' && error.meta !== null && 'body' in error.meta) {
    const body = error.meta.body;

    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'object' && body.error !== null) {
      const type = 'type' in body.error && typeof body.error.type === 'string' ? body.error.type : 'unknown';
      const reason = 'reason' in body.error && typeof body.error.reason === 'string' ? body.error.reason : '';

      return `${type}: ${reason}`.slice(0, 300);
    }
  }

  return (error instanceof Error ? error.message : String(error)).slice(0, 300);
}

function isBlockingStatus(status: number | undefined): boolean {
  return status === 401 || status === 403 || status === 404;
}

export function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  const starts = [trimmed.indexOf('{'), trimmed.indexOf('[')].filter((index) => index >= 0);

  if (starts.length === 0) {
    return undefined;
  }

  const start = Math.min(...starts);
  const closer = trimmed[start] === '{' ? '}' : ']';
  const end = trimmed.lastIndexOf(closer);

  if (end <= start) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return undefined;
  }
}

export function sanitizeForPrompt(value: string | undefined, maxChars: number = aiSettings.MAX_FIELD_CHARS): string {
  return (value ?? '').replace(/[<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

async function callInference(inferenceId: string, prompt: string): Promise<string> {
  const response = await getEsClient().inference.completion(
    {
      inference_id: inferenceId,
      input: `${systemPreamble}

${prompt}`,
      timeout: `${aiSettings.TIMEOUT_MS / 1000}s`,
    },
    { requestTimeout: aiSettings.TIMEOUT_MS, maxRetries: 0 },
  );

  return response.completion.map((choice) => choice.result).join('');
}

function inferenceAvailable(inferenceId: string): boolean {
  return isElasticConfigured() && Date.now() >= (inferenceBlockedUntil.get(inferenceId) ?? 0);
}

async function askAgent(prompt: string, span: Span): Promise<IModelAnswer | undefined> {
  if (!isAgentConfigured() || Date.now() < agentBlockedUntil) {
    return undefined;
  }

  try {
    return { text: await converseWithAgent(`${systemPreamble}

${prompt}`), provider: 'agent_builder' };
  } catch (error) {
    const status = errorStatus(error);
    span.setAttribute('kubequest.ai.agent_error_status', status ?? 0);

    if (isBlockingStatus(status)) {
      agentBlockedUntil = Date.now() + aiSettings.BREAKER_COOLDOWN_MS;
    }

    logger.warn({ status, reason: errorReason(error) }, 'agent builder call failed, trying inference API');

    return undefined;
  }
}

async function askInference(prompt: string, span: Span): Promise<IModelAnswer | undefined> {
  for (const inferenceId of aiSettings.COMPLETION_INFERENCE_IDS) {
    if (!inferenceAvailable(inferenceId)) {
      span.addEvent('ai.inference_skipped', { inference_id: inferenceId });
      continue;
    }

    try {
      const text = await callInference(inferenceId, prompt);
      span.setAttribute('kubequest.ai.inference_id', inferenceId);

      return { text, provider: 'inference' };
    } catch (error) {
      const status = errorStatus(error);
      const reason = errorReason(error);
      span.addEvent('ai.inference_error', { inference_id: inferenceId, status: status ?? 0, reason });
      span.setAttribute('kubequest.ai.inference_error_status', status ?? 0);

      if (isBlockingStatus(status)) {
        inferenceBlockedUntil.set(inferenceId, Date.now() + aiSettings.BREAKER_COOLDOWN_MS);
      }

      logger.warn({ inferenceId, status, reason }, 'inference completion failed');

      if (!isBlockingStatus(status)) {
        return undefined;
      }
    }
  }

  return undefined;
}

async function askModel(prompt: string, span: Span): Promise<IModelAnswer | undefined> {
  return (await askAgent(prompt, span)) ?? (await askInference(prompt, span));
}

export async function generateJson<T>(purpose: AiPurpose, prompt: string, validate: IJsonValidator<T>, fallback: () => T): Promise<IAiResult<T>> {
  return tracer.startActiveSpan<(span: Span) => Promise<IAiResult<T>>>(
    'ai.generate',
    { attributes: { 'kubequest.ai.purpose': purpose, 'kubequest.ai.prompt_chars': prompt.length } },
    async (span) => {
      const startedAt = performance.now();
      const key = cacheKey(purpose, prompt);

      try {
        const cached = readCache(key);

        if (cached && validate(cached.value)) {
          span.setAttributes({ 'kubequest.ai.provider': cached.provider, 'kubequest.ai.cache_hit': true });

          return { value: cached.value, provider: cached.provider, purpose, cacheHit: true };
        }

        for (let attempt = 1; attempt <= aiSettings.MAX_ATTEMPTS; attempt += 1) {
          span.setAttribute('kubequest.ai.attempts', attempt);
          const answer = await askModel(prompt, span);

          if (!answer) {
            break;
          }

          const parsed = extractJson(answer.text);

          if (validate(parsed)) {
            writeCache(key, parsed, answer.provider);
            span.setAttributes({ 'kubequest.ai.provider': answer.provider, 'kubequest.ai.cache_hit': false, 'kubequest.ai.valid': true });

            return { value: parsed, provider: answer.provider, purpose, cacheHit: false };
          }

          span.addEvent('ai.invalid_output', { attempt });
        }

        const value = fallback();
        span.setAttributes({ 'kubequest.ai.provider': 'fallback', 'kubequest.ai.cache_hit': false, 'kubequest.ai.valid': validate(value) });

        return { value, provider: 'fallback', purpose, cacheHit: false };
      } catch (error) {
        span.recordException(error instanceof Error ? error : new Error(String(error)));
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.setAttributes({ 'kubequest.ai.provider': 'fallback', 'kubequest.ai.cache_hit': false });

        return { value: fallback(), provider: 'fallback', purpose, cacheHit: false };
      } finally {
        span.setAttribute('kubequest.ai.duration_ms', Math.round(performance.now() - startedAt));
        span.end();
      }
    },
  );
}
