import { createHash } from 'node:crypto';
import { trace } from '@opentelemetry/api';
import { converseWithAgentDetailed, isAgentConfigured } from '../ai/agent-builder';
import { extractJson, sanitizeForPrompt } from '../ai/client';
import { aiSettings, systemPreamble } from '../ai/prompts.constants';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { isPublicId, resolvePlayerId } from '../profile/public-id';
import { IAttendee, ILocation } from '../types/kubequest.interfaces';
import { askAnswerTemplate, askFallbackAnswer, askSettings } from './search.constants';
import { IAskAnswer, IAskAnswerInput, IAskCitation } from './search.interfaces';
import { AskResultKind } from './search.types';

interface IAnswerSource {
  resultId: string;
  kind: AskResultKind;
  title: string;
  text: string;
}

interface IModelAnswer {
  answer: string;
  citations: number[];
}

interface ISettledAnswer {
  value: IModelAnswer;
  expiresAt: number;
}

const settled = new Map<string, ISettledAnswer>();
const inflight = new Map<string, Promise<IModelAnswer | undefined>>();

interface ITalkAnswerSource {
  title?: string;
  abstract?: string;
  speakers?: string[];
  start?: string;
  room?: string;
  building?: string;
  summary?: string;
}

function parseResultId(resultId: string): { kind: AskResultKind; id: string } | undefined {
  const separator = resultId.indexOf(':');
  const kind = resultId.slice(0, separator);
  const id = resultId.slice(separator + 1);

  if (separator <= 0 || id === '') {
    return undefined;
  }

  return kind === 'talk' || kind === 'person' || kind === 'booth' ? { kind, id } : undefined;
}

async function talkSource(resultId: string, id: string): Promise<IAnswerSource | undefined> {
  const response = await getEsClient().get<ITalkAnswerSource>(
    { index: indexNames.TALKS, id, _source_includes: ['title', 'abstract', 'speakers', 'start', 'room', 'building', 'summary'] },
    esOptions(esTimeouts.DEFAULT_MS),
  );
  const talk = response._source;

  if (!talk) {
    return undefined;
  }

  const parts = [
    `Session "${talk.title ?? ''}"`,
    `Speakers: ${(talk.speakers ?? []).join(', ')}`,
    `When: ${talk.start ?? ''} in ${talk.room ?? ''}, ${talk.building ?? ''}`,
    `Abstract: ${talk.abstract ?? ''}`,
    talk.summary ? `AI summary from the abstract (not a transcript): ${talk.summary}` : '',
  ];

  return { resultId, kind: 'talk', title: talk.title ?? id, text: parts.filter(Boolean).join('. ') };
}

async function personSource(resultId: string, id: string): Promise<IAnswerSource | undefined> {
  if (!isPublicId(id)) {
    return undefined;
  }

  const attendeeId = await resolvePlayerId(id);
  const response = await getEsClient().get<Partial<IAttendee>>(
    { index: indexNames.ATTENDEES, id: attendeeId, _source_includes: ['handle', 'headline', 'workingOn', 'profile.topics', 'visible', 'settings.meetingOn'] },
    esOptions(esTimeouts.DEFAULT_MS),
  );
  const person = response._source;

  if (!person || person.visible !== true || person.settings?.meetingOn !== true) {
    return undefined;
  }

  const text = [
    `Attendee @${person.handle ?? ''}`,
    person.headline ? `Headline: ${person.headline}` : '',
    `Working on: ${person.workingOn ?? ''}`,
    `Topics: ${(person.profile?.topics ?? []).join(', ')}`,
  ];

  return { resultId, kind: 'person', title: `@${person.handle ?? ''}`, text: text.filter(Boolean).join('. ') };
}

async function boothSource(resultId: string, id: string): Promise<IAnswerSource | undefined> {
  const response = await getEsClient().get<Partial<ILocation>>(
    { index: indexNames.LOCATIONS, id, _source_includes: ['name', 'kind', 'boothNumber', 'askAbout', 'description', 'building', 'level'] },
    esOptions(esTimeouts.DEFAULT_MS),
  );
  const booth = response._source;

  if (!booth || booth.kind !== 'outpost') {
    return undefined;
  }

  const text = [
    `Booth ${booth.name ?? ''}${booth.boothNumber ? ` (#${booth.boothNumber})` : ''}`,
    `Where: ${booth.building ?? ''} ${booth.level ?? ''}`,
    booth.askAbout ? `Ask about: ${booth.askAbout}` : '',
    booth.description ?? '',
  ];

  return { resultId, kind: 'booth', title: booth.name ?? id, text: text.filter(Boolean).join('. ') };
}

async function loadSource(resultId: string): Promise<IAnswerSource | undefined> {
  const parsed = parseResultId(resultId);

  if (!parsed) {
    return undefined;
  }

  try {
    if (parsed.kind === 'talk') {
      return await talkSource(resultId, parsed.id);
    }

    return parsed.kind === 'person' ? await personSource(resultId, parsed.id) : await boothSource(resultId, parsed.id);
  } catch (error) {
    logger.warn({ err: error, kind: parsed.kind }, 'ask_answer source lookup failed');

    return undefined;
  }
}

function buildPrompt(query: string, sources: IAnswerSource[]): string {
  const numbered = sources.map((source, index) => `[${index + 1}] ${sanitizeForPrompt(source.text, askSettings.SOURCE_TEXT_CHARS)}`).join('\n');

  return `${askAnswerTemplate}

Question: <data>${sanitizeForPrompt(query, askSettings.QUERY_MAX_CHARS)}</data>

Sources:
<data>
${numbered}
</data>`;
}

function validator(count: number): (value: unknown) => value is IModelAnswer {
  return (value: unknown): value is IModelAnswer => {
    if (typeof value !== 'object' || value === null || !('answer' in value) || !('citations' in value)) {
      return false;
    }

    const { answer, citations } = value as { answer: unknown; citations: unknown };

    if (typeof answer !== 'string' || answer.length < askSettings.ANSWER_MIN_CHARS || answer.length > askSettings.ANSWER_MAX_CHARS) {
      return false;
    }

    const inline = [...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1]));

    if (inline.length === 0 || inline.some((n) => n < 1 || n > count)) {
      return false;
    }

    return Array.isArray(citations) && citations.every((n) => typeof n === 'number' && n >= 1 && n <= count);
  };
}

function citationsFor(answer: string, sources: IAnswerSource[]): IAskCitation[] {
  const used = [...new Set([...answer.matchAll(/\[(\d+)\]/g)].map((match) => Number(match[1])))].sort((a, b) => a - b);

  return used.map((n) => {
    const source = sources[n - 1];

    return { n, resultId: source.resultId, kind: source.kind, title: source.title };
  });
}

function answerKey(prompt: string): string {
  return createHash('sha256').update(prompt).digest('hex');
}

function readSettled(key: string): IModelAnswer | undefined {
  const entry = settled.get(key);

  if (entry && entry.expiresAt > Date.now()) {
    return entry.value;
  }

  settled.delete(key);

  return undefined;
}

function remember(key: string, value: IModelAnswer): void {
  if (settled.size >= askSettings.CACHE_MAX_ENTRIES) {
    const oldest = settled.keys().next().value;

    if (oldest !== undefined) {
      settled.delete(oldest);
    }
  }

  settled.set(key, { value, expiresAt: Date.now() + askSettings.CACHE_TTL_MS });
}

async function askAgent(key: string, prompt: string, count: number): Promise<IModelAnswer | undefined> {
  const validate = validator(count);

  try {
    for (let attempt = 1; attempt <= aiSettings.MAX_ATTEMPTS; attempt += 1) {
      const reply = await converseWithAgentDetailed(`${systemPreamble}

${prompt}`, undefined, askSettings.AGENT_TIMEOUT_MS);
      const parsed = extractJson(reply.message);

      if (validate(parsed)) {
        remember(key, parsed);

        return parsed;
      }

      logger.warn({ attempt }, 'ask_answer agent reply was not a valid cited answer');
    }

    return undefined;
  } catch (error) {
    logger.warn({ err: error }, 'ask_answer agent call failed');

    return undefined;
  } finally {
    inflight.delete(key);
  }
}

function waitAtMost(ms: number): Promise<'timeout'> {
  return new Promise((resolve) => setTimeout(() => resolve('timeout'), ms).unref());
}

export async function askAnswer(input: IAskAnswerInput): Promise<IAskAnswer> {
  const span = trace.getActiveSpan();
  const query = input.query.trim();
  const ids = [...new Set(input.resultIds)].slice(0, askSettings.TOP_FOR_ANSWER);
  const sources = (await Promise.all(ids.map((resultId) => loadSource(resultId)))).filter((source): source is IAnswerSource => source !== undefined);
  const fallback: IAskAnswer = { query, answer: askFallbackAnswer, citations: [], provider: 'fallback', pending: false };

  if (query === '' || sources.length === 0 || !isAgentConfigured()) {
    return fallback;
  }

  const prompt = buildPrompt(query, sources);
  const key = answerKey(prompt);
  const cached = readSettled(key);
  const work = cached ? undefined : (inflight.get(key) ?? startAgent(key, prompt, sources.length));
  const outcome = cached ?? (work ? await Promise.race([work, waitAtMost(aiSettings.BUDGET_MS.search_answer)]) : undefined);

  span?.setAttributes({ 'kubequest.ai.purpose': 'search_answer', 'kubequest.ai.cache_hit': cached !== undefined, 'kubequest.ask.sources': sources.length });

  if (outcome === 'timeout') {
    span?.setAttribute('kubequest.ai.provider', 'fallback');

    return { ...fallback, pending: inflight.has(key) };
  }

  if (!outcome) {
    span?.setAttribute('kubequest.ai.provider', 'fallback');

    return fallback;
  }

  const answer = outcome.answer.trim();
  span?.setAttribute('kubequest.ai.provider', 'agent_builder');

  return { query, answer, citations: citationsFor(answer, sources), provider: 'agent_builder', pending: false };
}

function startAgent(key: string, prompt: string, count: number): Promise<IModelAnswer | undefined> {
  const work = askAgent(key, prompt, count);
  inflight.set(key, work);

  return work;
}
