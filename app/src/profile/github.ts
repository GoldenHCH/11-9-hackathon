import { logger } from '../observability/logger';
import { tracer } from '../observability/tracing';
import { signupLimits } from './profile.constants';

export interface IGithubProfile {
  login: string;
  name?: string;
  avatarUrl?: string;
  bio?: string;
  languages: string[];
}

interface IGithubUser {
  login?: unknown;
  name?: unknown;
  avatar_url?: unknown;
  bio?: unknown;
}

interface IGithubRepo {
  language?: unknown;
  fork?: unknown;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

async function fetchGithub(path: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    signal,
    headers: { accept: 'application/vnd.github+json', 'user-agent': 'kubequest' },
  });

  if (!response.ok) {
    throw new Error(`github ${response.status}`);
  }

  return response.json();
}

function topLanguages(repos: unknown): string[] {
  if (!Array.isArray(repos)) {
    return [];
  }

  const counts = new Map<string, number>();

  for (const repo of repos as IGithubRepo[]) {
    const language = asString(repo.language);

    if (language && repo.fork !== true) {
      counts.set(language, (counts.get(language) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, signupLimits.GITHUB_LANGUAGES)
    .map(([language]) => language);
}

export async function importGithubProfile(login: string): Promise<IGithubProfile | undefined> {
  return tracer.startActiveSpan('github.import_profile', async (span) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), signupLimits.GITHUB_TIMEOUT_MS);
    const encoded = encodeURIComponent(login);

    try {
      const [user, repos] = await Promise.all([
        fetchGithub(`/users/${encoded}`, controller.signal) as Promise<IGithubUser>,
        fetchGithub(`/users/${encoded}/repos?sort=pushed&per_page=${signupLimits.GITHUB_REPO_SAMPLE}`, controller.signal).catch(() => []),
      ]);
      const languages = topLanguages(repos);
      span.setAttribute('kubequest.github.imported', true);
      span.setAttribute('kubequest.github.languages', languages.length);

      return {
        login: asString(user.login) ?? login,
        name: asString(user.name),
        avatarUrl: asString(user.avatar_url),
        bio: asString(user.bio),
        languages,
      };
    } catch (error) {
      span.setAttribute('kubequest.github.imported', false);
      logger.info({ err: error instanceof Error ? error.message : String(error) }, 'github import skipped');

      return undefined;
    } finally {
      clearTimeout(timer);
      span.end();
    }
  });
}
