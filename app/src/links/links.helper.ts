import { ToolError } from '../tools/tool-errors';
import { ILinkItem, IProfileLinks } from '../types/connections.interfaces';
import { linkNetworks } from '../types/connections.constants';
import { LinkNetwork } from '../types/connections.types';

const githubLoginPattern = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const xHandlePattern = /^[a-z0-9_]{1,15}$/i;
const linkedinSlugPattern = /^[a-z0-9\-_%.]{3,100}$/i;
const domainPattern = /^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const mastodonUserPattern = /^[a-z0-9_]{1,30}$/i;

const networkNames: Record<LinkNetwork, string> = {
  linkedin: 'LinkedIn',
  github: 'GitHub',
  x: 'X',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  website: 'Website',
};

const examples: Record<LinkNetwork, string> = {
  linkedin: 'linkedin.com/in/your-name',
  github: 'your GitHub username or github.com/you',
  x: '@you or x.com/you',
  bluesky: 'you.bsky.social or bsky.app/profile/you.bsky.social',
  mastodon: '@you@hachyderm.io',
  website: 'https://your-site.dev',
};

function invalid(network: LinkNetwork): never {
  throw new ToolError(400, 'invalid_input', `That ${networkNames[network]} link doesn't look right. Try ${examples[network]}.`);
}

function parseUrl(raw: string): URL | undefined {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    return new URL(withScheme);
  } catch {
    return undefined;
  }
}

function looksLikeUrl(raw: string): boolean {
  return raw.includes('/') || /^[a-z][a-z0-9+.-]*:/i.test(raw);
}

function hostIs(url: URL, domains: string[]): boolean {
  const host = url.hostname.toLowerCase();

  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function firstPathSegments(url: URL): string[] {
  return url.pathname.split('/').filter((segment) => segment !== '');
}

function normalizeLinkedin(raw: string): string {
  if (!looksLikeUrl(raw)) {
    return linkedinSlugPattern.test(raw) ? `https://www.linkedin.com/in/${raw}` : invalid('linkedin');
  }

  const url = parseUrl(raw);
  const [section, slug] = url && hostIs(url, ['linkedin.com']) ? firstPathSegments(url) : [];

  if (section !== 'in' || !slug || !linkedinSlugPattern.test(slug)) {
    return invalid('linkedin');
  }

  return `https://www.linkedin.com/in/${slug}`;
}

export function githubLoginFrom(link: string): string | undefined {
  const url = parseUrl(link);
  const [login] = url && hostIs(url, ['github.com']) ? firstPathSegments(url) : [];

  return login && githubLoginPattern.test(login) ? login : undefined;
}

function normalizeGithub(raw: string): string {
  const bare = raw.replace(/^@/, '');

  if (!looksLikeUrl(bare)) {
    return githubLoginPattern.test(bare) ? `https://github.com/${bare}` : invalid('github');
  }

  const url = parseUrl(bare);
  const segments = url && hostIs(url, ['github.com']) && url.hostname.toLowerCase() !== 'gist.github.com' ? firstPathSegments(url) : [];
  const login = segments[0];

  if (!login || segments.length > 1 || !githubLoginPattern.test(login)) {
    return invalid('github');
  }

  return `https://github.com/${login}`;
}

function normalizeX(raw: string): string {
  const bare = raw.replace(/^@/, '');

  if (!looksLikeUrl(bare)) {
    return xHandlePattern.test(bare) ? `https://x.com/${bare}` : invalid('x');
  }

  const url = parseUrl(bare);
  const [handle] = url && hostIs(url, ['x.com', 'twitter.com']) ? firstPathSegments(url) : [];

  if (!handle || !xHandlePattern.test(handle)) {
    return invalid('x');
  }

  return `https://x.com/${handle}`;
}

export function blueskyHandleFrom(link: string): string | undefined {
  const url = parseUrl(link);
  const [section, handle] = url && hostIs(url, ['bsky.app']) ? firstPathSegments(url) : [];

  return section === 'profile' && handle && domainPattern.test(handle) ? handle.toLowerCase() : undefined;
}

function normalizeBluesky(raw: string): string {
  const bare = raw.replace(/^@/, '');

  if (!looksLikeUrl(bare)) {
    return domainPattern.test(bare) ? `https://bsky.app/profile/${bare.toLowerCase()}` : invalid('bluesky');
  }

  const url = parseUrl(bare);
  const handle = url ? blueskyHandleFrom(url.toString()) : undefined;

  return handle ? `https://bsky.app/profile/${handle}` : invalid('bluesky');
}

function normalizeMastodon(raw: string): string {
  const address = raw.replace(/^@/, '').match(/^([^@\s/]+)@([^@\s/]+)$/);

  if (address) {
    const [, user, host] = address;

    return user && host && mastodonUserPattern.test(user) && domainPattern.test(host) ? `https://${host.toLowerCase()}/@${user}` : invalid('mastodon');
  }

  const url = parseUrl(raw);
  const [segment] = url ? firstPathSegments(url) : [];
  const user = segment?.startsWith('@') ? segment.slice(1) : undefined;

  if (!url || url.protocol !== 'https:' || !domainPattern.test(url.hostname) || !user || !mastodonUserPattern.test(user)) {
    return invalid('mastodon');
  }

  return `https://${url.hostname.toLowerCase()}/@${user}`;
}

function normalizeWebsite(raw: string): string {
  if (/^http:\/\//i.test(raw)) {
    return invalid('website');
  }

  const url = parseUrl(raw);

  if (!url || url.protocol !== 'https:' || !domainPattern.test(url.hostname) || url.username !== '' || url.password !== '') {
    return invalid('website');
  }

  return url.toString();
}

const normalizers: Record<LinkNetwork, (raw: string) => string> = {
  linkedin: normalizeLinkedin,
  github: normalizeGithub,
  x: normalizeX,
  bluesky: normalizeBluesky,
  mastodon: normalizeMastodon,
  website: normalizeWebsite,
};

export function normalizeLink(network: LinkNetwork, raw: string): string | undefined {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return undefined;
  }

  return normalizers[network](trimmed);
}

export function mergeLinks(current: IProfileLinks, changes: IProfileLinks): IProfileLinks {
  const merged: IProfileLinks = { ...current };

  for (const network of linkNetworks) {
    const raw = changes[network];

    if (raw === undefined) {
      continue;
    }

    const normalized = normalizeLink(network, raw);

    if (normalized) {
      merged[network] = normalized;
    } else {
      delete merged[network];
    }
  }

  return merged;
}

function labelFor(network: LinkNetwork, url: string): string {
  const parsed = parseUrl(url);

  if (!parsed) {
    return url;
  }

  const segments = firstPathSegments(parsed);

  switch (network) {
    case 'linkedin':
      return `in/${segments[1] ?? ''}`;
    case 'github':
    case 'x':
      return `@${segments[0] ?? ''}`;
    case 'bluesky':
      return `@${segments[1] ?? ''}`;
    case 'mastodon':
      return `${segments[0] ?? ''}@${parsed.hostname}`;
    case 'website':
      return `${parsed.hostname}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  }
}

export function linkItems(links: IProfileLinks | undefined): ILinkItem[] {
  if (!links) {
    return [];
  }

  return linkNetworks.flatMap((network) => {
    const url = links[network];

    return url ? [{ network, label: labelFor(network, url), url }] : [];
  });
}

export function linkNetworkName(network: LinkNetwork): string {
  return networkNames[network];
}
