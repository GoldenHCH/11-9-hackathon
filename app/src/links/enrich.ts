import { logger } from '../observability/logger';
import { tracer } from '../observability/tracing';
import { importGithubProfile } from '../profile/github';
import { ILinkEnrichment } from '../types/connections.interfaces';
import { connectionRules } from '../types/connections.constants';

export const publicProfileMarker = 'Public profile:';

interface IBlueskyProfile {
  handle?: unknown;
  displayName?: unknown;
  description?: unknown;
  followersCount?: unknown;
}

function asText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.replace(/\s+/g, ' ').trim() : undefined;
}

function clip(value: string, maxChars: number): string {
  return value.length > maxChars ? `${value.slice(0, maxChars - 1).trimEnd()}…` : value;
}

export async function githubSummary(login: string): Promise<ILinkEnrichment> {
  const profile = await importGithubProfile(login);

  if (!profile) {
    return { network: 'github', status: 'unavailable' };
  }

  const parts = [
    `GitHub @${profile.login}${profile.name ? ` (${profile.name})` : ''}.`,
    profile.bio ? `Bio: ${profile.bio}.` : '',
    profile.languages.length > 0 ? `Writes mostly ${profile.languages.slice(0, connectionRules.TOP_LANGUAGES).join(', ')}.` : '',
  ];

  return { network: 'github', status: 'added', summary: clip(parts.filter((part) => part !== '').join(' '), connectionRules.PROFILE_SUMMARY_MAX_CHARS) };
}

export async function blueskySummary(handle: string): Promise<ILinkEnrichment> {
  return tracer.startActiveSpan('bluesky.get_profile', async (span) => {
    try {
      const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(handle)}`, {
        signal: AbortSignal.timeout(connectionRules.ENRICH_TIMEOUT_MS),
        headers: { accept: 'application/json', 'user-agent': 'kubequest' },
      });
      span.setAttribute('http.response.status_code', response.status);

      if (response.status === 400 || response.status === 404) {
        return { network: 'bluesky', status: 'not_found' } satisfies ILinkEnrichment;
      }

      if (!response.ok) {
        throw new Error(`bluesky ${response.status}`);
      }

      const profile = (await response.json()) as IBlueskyProfile;
      const name = asText(profile.displayName);
      const description = asText(profile.description);
      const parts = [`Bluesky @${asText(profile.handle) ?? handle}${name ? ` (${name})` : ''}.`, description ? `Bio: ${description}.` : ''];

      return {
        network: 'bluesky',
        status: 'added',
        summary: clip(parts.filter((part) => part !== '').join(' '), connectionRules.PROFILE_SUMMARY_MAX_CHARS),
      } satisfies ILinkEnrichment;
    } catch (error) {
      logger.info({ err: error instanceof Error ? error.message : String(error) }, 'bluesky enrichment skipped');

      return { network: 'bluesky', status: 'unavailable' } satisfies ILinkEnrichment;
    } finally {
      span.end();
    }
  });
}

export function withPublicProfile(profileText: string, summaries: string[]): string {
  const base = profileText.split(`\n\n${publicProfileMarker}`)[0]?.trimEnd() ?? '';

  return summaries.length > 0 ? `${base}\n\n${publicProfileMarker} ${summaries.join(' ')}` : base;
}
