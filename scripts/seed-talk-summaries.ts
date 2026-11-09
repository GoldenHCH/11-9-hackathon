import { readFileSync } from 'node:fs';
import { converseWithAgentDetailed, isAgentConfigured } from '../app/src/ai/agent-builder';
import { extractJson, sanitizeForPrompt } from '../app/src/ai/client';
import { closeEsClient, esOptions, getEsClient } from '../app/src/es/client';
import { esTimeouts, indexNames } from '../app/src/es/es.constants';
import { ensureIndices } from '../app/src/es/indices';
import { talkSummaryTemplate } from '../app/src/search/search.constants';
import { SummarySource } from '../app/src/search/search.types';
import { resourcePath, writeJsonFile } from './lib/resource-files.helper';

interface ISessionRecord {
  id: string;
  title: string;
  abstract: string;
  track: string;
  speakers: (string | { name: string })[];
  summary?: string;
  summarySource?: SummarySource;
  [key: string]: unknown;
}

const summarySettings = {
  SKIP_IDS: ['cnh-kickoff-2026'] as string[],
  CONCURRENCY: 4,
  ATTEMPTS: 4,
  AGENT_TIMEOUT_MS: 90_000,
  MIN_WORDS: 260,
  MAX_WORDS: 560,
  BACKOFF_MS: 3000,
  SOURCE: 'ai_from_abstract' as SummarySource,
} as const;

const forbiddenPatterns = [/["“”]/, /\b(I|I'm|I've|I'll|my|we|we're|our|us)\b/];

function speakerNames(session: ISessionRecord): string[] {
  return session.speakers.map((speaker) => (typeof speaker === 'string' ? speaker : speaker.name));
}

function buildPrompt(session: ISessionRecord): string {
  return `${talkSummaryTemplate}

<data>
Title: ${sanitizeForPrompt(session.title, 300)}
Abstract: ${sanitizeForPrompt(session.abstract, 1200)}
Track: ${sanitizeForPrompt(session.track, 40)}
Speakers: ${sanitizeForPrompt(speakerNames(session).join(', '), 400)}
</data>`;
}

function validSummary(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || !('summary' in value) || typeof value.summary !== 'string') {
    return undefined;
  }

  const summary = value.summary.replace(/[ \t]+/g, ' ').trim();
  const words = summary.split(/\s+/).length;

  if (words < summarySettings.MIN_WORDS || words > summarySettings.MAX_WORDS || !summary.startsWith('This session covers')) {
    return undefined;
  }

  return forbiddenPatterns.some((pattern) => pattern.test(summary)) ? undefined : summary;
}

async function generateSummary(session: ISessionRecord): Promise<string> {
  let lastProblem = '';

  for (let attempt = 1; attempt <= summarySettings.ATTEMPTS; attempt += 1) {
    try {
      const reply = await converseWithAgentDetailed(buildPrompt(session), undefined, summarySettings.AGENT_TIMEOUT_MS);
      const summary = validSummary(extractJson(reply.message));

      if (summary) {
        return summary;
      }

      lastProblem = `invalid output (${reply.message.split(/\s+/).length} words)`;
    } catch (error) {
      lastProblem = error instanceof Error ? error.message.slice(0, 200) : String(error);
    }

    console.log(`  ${session.id}: attempt ${attempt} failed: ${lastProblem}`);
    await new Promise((resolve) => setTimeout(resolve, summarySettings.BACKOFF_MS * attempt));
  }

  throw new Error(`${session.id}: no valid summary after ${summarySettings.ATTEMPTS} attempts (${lastProblem})`);
}

async function liveSummary(id: string): Promise<string | undefined> {
  try {
    const response = await getEsClient().get<{ summary?: string }>(
      { index: indexNames.TALKS, id, _source_includes: ['summary'] },
      esOptions(esTimeouts.DEFAULT_MS),
    );

    return response._source?.summary;
  } catch {
    return undefined;
  }
}

async function storeSummary(id: string, summary: string): Promise<void> {
  await getEsClient().update(
    { index: indexNames.TALKS, id, doc: { summary, summarySource: summarySettings.SOURCE }, retry_on_conflict: 3 },
    esOptions(esTimeouts.INFERENCE_MS),
  );
}

async function processSession(session: ISessionRecord): Promise<'generated' | 'skipped' | 'synced'> {
  if (session.summary) {
    if (!(await liveSummary(session.id))) {
      await storeSummary(session.id, session.summary);

      return 'synced';
    }

    return 'skipped';
  }

  const existing = await liveSummary(session.id);
  const summary = existing ?? (await generateSummary(session));

  if (!existing) {
    await storeSummary(session.id, summary);
  }

  session.summary = summary;
  session.summarySource = summarySettings.SOURCE;

  return existing ? 'synced' : 'generated';
}

async function main(): Promise<void> {
  if (!isAgentConfigured()) {
    throw new Error('Agent Builder is not configured (ELASTIC_API_KEY and KIBANA_URL or ELASTIC_URL)');
  }

  const sessionsPath = resourcePath('sessions.json');
  const sessions = JSON.parse(readFileSync(sessionsPath, 'utf8')) as ISessionRecord[];
  const targets = sessions.filter((session) => !summarySettings.SKIP_IDS.includes(session.id));
  const counts = { generated: 0, skipped: 0, synced: 0, failed: 0 };

  for (const result of await ensureIndices()) {
    if (result.index === indexNames.TALKS) {
      console.log(`index talks: ${result.action} ${result.addedFields.join(', ')}`);
    }
  }

  const queue = [...targets];
  const workers = Array.from({ length: summarySettings.CONCURRENCY }, async () => {
    for (let session = queue.shift(); session; session = queue.shift()) {
      try {
        const outcome = await processSession(session);
        counts[outcome] += 1;
        console.log(`${outcome}: ${session.id}`);
        writeJsonFile(sessionsPath, sessions);
      } catch (error) {
        counts.failed += 1;
        console.error(error instanceof Error ? error.message : error);
      }
    }
  });

  await Promise.all(workers);
  writeJsonFile(sessionsPath, sessions);
  await closeEsClient();
  console.log(`summaries: ${JSON.stringify(counts)}`);

  if (counts.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
