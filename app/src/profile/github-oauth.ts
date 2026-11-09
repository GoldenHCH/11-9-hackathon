import { randomBytes } from 'node:crypto';
import { trace } from '@opentelemetry/api';
import { appConfig } from '../config';
import { signGithubState, verifyGithubState } from '../security/tokens';
import { ToolError } from '../tools/tool-errors';
import { getAttendee, patchAttendee } from './attendees';

const STATE_TTL_MS = 10 * 60 * 1000;
const NONCE_BYTES = 16;
const FETCH_TIMEOUT_MS = 8000;

export const githubStateCookie = 'kq_gh_state';

export const githubCallbackPath = '/auth/github/callback';

function clientId(): string {
  return process.env.GITHUB_OAUTH_CLIENT_ID?.trim() ?? '';
}

function clientSecret(): string {
  return process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim() ?? '';
}

export function isGithubOAuthConfigured(): boolean {
  return clientId() !== '' && clientSecret() !== '';
}

function callbackUrl(): string {
  return new URL(githubCallbackPath, appConfig.publicBaseUrl).toString();
}

export async function startGithubVerify(attendeeId: string): Promise<{ redirectUrl: string; nonce: string; maxAgeMs: number }> {
  if (!isGithubOAuthConfigured()) {
    throw new ToolError(404, 'github_verify_off', 'GitHub verification is not switched on here.');
  }

  const attendee = await getAttendee(attendeeId);
  const nonce = randomBytes(NONCE_BYTES).toString('base64url');
  const state = signGithubState(attendee.id, nonce, new Date(Date.now() + STATE_TTL_MS));
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', clientId());
  url.searchParams.set('redirect_uri', callbackUrl());
  url.searchParams.set('state', state);
  url.searchParams.set('allow_signup', 'false');

  return { redirectUrl: url.toString(), nonce, maxAgeMs: STATE_TTL_MS };
}

async function exchangeCode(code: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', 'user-agent': 'kubequest' },
    body: JSON.stringify({ client_id: clientId(), client_secret: clientSecret(), code, redirect_uri: callbackUrl() }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body: unknown = await response.json();
  const token = typeof body === 'object' && body !== null ? Reflect.get(body, 'access_token') : undefined;

  if (!response.ok || typeof token !== 'string' || token === '') {
    throw new ToolError(502, 'github_exchange_failed', 'GitHub did not confirm the sign-in. Try again.');
  }

  return token;
}

async function githubLogin(token: string): Promise<string> {
  const response = await fetch('https://api.github.com/user', {
    headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'user-agent': 'kubequest' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const body: unknown = await response.json();
  const login = typeof body === 'object' && body !== null ? Reflect.get(body, 'login') : undefined;

  if (!response.ok || typeof login !== 'string' || login === '') {
    throw new ToolError(502, 'github_user_failed', 'GitHub did not share your username. Try again.');
  }

  return login;
}

export async function finishGithubVerify(code: string, state: string, cookieNonce: string): Promise<string> {
  const checked = verifyGithubState(state);

  if (!checked || cookieNonce === '' || checked.nonce !== cookieNonce) {
    throw new ToolError(400, 'github_state_invalid', 'That GitHub sign-in expired or came from another browser. Start again from your profile.');
  }

  const attendee = await getAttendee(checked.attendeeId);
  const login = await githubLogin(await exchangeCode(code));
  const github = `https://github.com/${login}`;
  await patchAttendee(attendee.id, { links: { ...(attendee.links ?? {}), github }, githubVerified: true, githubLogin: login });
  trace.getActiveSpan()?.setAttribute('kubequest.github.verified', true);

  return attendee.id;
}
