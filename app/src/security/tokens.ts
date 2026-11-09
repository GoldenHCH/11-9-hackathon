import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { appConfig, readQrSecret } from '../config';
import { ToolError } from '../tools/tool-errors';
import { IHandshakeTokenCheck, ITokenCheck } from '../types/internal.interfaces';

const PRINTED_PREFIX = 'p';
const SCREEN_PREFIX = 's';
const ACCESS_PREFIX = 'k';
const ADMIN_SCOPE = 'admin';
const EXHIBITOR_SCOPE = 'exhibitor';
const HANDSHAKE_PREFIX = 'h';
const HANDSHAKE_NONCE_BYTES = 9;

export const SCREEN_TOKEN_TTL_MS = 10 * 60 * 1000;

function qrSecret(): string {
  const secret = readQrSecret();

  if (secret === '') {
    throw new ToolError(503, 'qr_secret_missing', 'Check-ins are not switched on yet. Try again in a minute.');
  }

  return secret;
}

function sign(payload: string): string {
  return createHmac('sha256', qrSecret()).update(payload).digest('base64url');
}

function sameSignature(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected, 'utf8');
  const actualBytes = Buffer.from(actual, 'utf8');

  if (expectedBytes.length !== actualBytes.length) {
    timingSafeEqual(expectedBytes, expectedBytes);

    return false;
  }

  return timingSafeEqual(expectedBytes, actualBytes);
}

export function signLocationToken(locationId: string): string {
  return `${PRINTED_PREFIX}.${sign(`${PRINTED_PREFIX}:${locationId}`)}`;
}

export function signScreenToken(locationId: string, expiresAt: Date): string {
  const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1000).toString(36);

  return `${SCREEN_PREFIX}.${expiresAtSeconds}.${sign(`${SCREEN_PREFIX}:${locationId}:${expiresAtSeconds}`)}`;
}

export function verifyLocationToken(locationId: string, token: string, now: Date = new Date()): ITokenCheck {
  const trimmed = token.trim();

  if (trimmed === '') {
    return { valid: false, reason: 'missing_token' };
  }

  const parts = trimmed.split('.');

  if (parts[0] === PRINTED_PREFIX && parts.length === 2) {
    const valid = sameSignature(sign(`${PRINTED_PREFIX}:${locationId}`), parts[1] ?? '');

    return valid ? { valid: true } : { valid: false, reason: 'bad_signature' };
  }

  if (parts[0] === SCREEN_PREFIX && parts.length === 3) {
    const expiresAtSeconds = parts[1] ?? '';
    const valid = sameSignature(sign(`${SCREEN_PREFIX}:${locationId}:${expiresAtSeconds}`), parts[2] ?? '');

    if (!valid) {
      return { valid: false, reason: 'bad_signature' };
    }

    const expiresAt = new Date(parseInt(expiresAtSeconds, 36) * 1000);

    if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < now.getTime()) {
      return { valid: false, reason: 'expired_token', expiresAt };
    }

    return { valid: true, expiresAt };
  }

  return { valid: false, reason: 'bad_signature' };
}

export function signScreenDisplayKey(locationId: string): string {
  return sign(`screen:${locationId}`);
}

export function verifyScreenDisplayKey(locationId: string, key: string): boolean {
  return sameSignature(signScreenDisplayKey(locationId), key.trim());
}

export function buildScanUrl(locationId: string, token: string): string {
  const url = new URL(`/r/${encodeURIComponent(locationId)}`, appConfig.publicBaseUrl);
  url.searchParams.set('t', token);

  return url.toString();
}

export function signAccessKey(scope: string): string {
  return `${ACCESS_PREFIX}.${sign(`${ACCESS_PREFIX}:${scope}`)}`;
}

export function verifyAccessKey(scope: string, key: string): boolean {
  const trimmed = key.trim();

  if (trimmed === '' || !trimmed.startsWith(`${ACCESS_PREFIX}.`)) {
    return false;
  }

  return sameSignature(signAccessKey(scope), trimmed);
}

export function adminAccessScope(): string {
  return ADMIN_SCOPE;
}

export function exhibitorAccessScope(outpostId: string): string {
  return `${EXHIBITOR_SCOPE}:${outpostId}`;
}

export function adminAccessKey(): string {
  return signAccessKey(adminAccessScope());
}

export function exhibitorAccessKey(outpostId: string): string {
  return signAccessKey(exhibitorAccessScope(outpostId));
}

export function buildStaffUrl(outpostId: string, key: string): string {
  const url = new URL(`/exhibitor/${encodeURIComponent(outpostId)}`, appConfig.publicBaseUrl);
  url.searchParams.set('k', key);

  return url.toString();
}

export function buildAdminUrl(key: string): string {
  const url = new URL('/admin', appConfig.publicBaseUrl);
  url.searchParams.set('k', key);

  return url.toString();
}

export function signHandshakeToken(playerId: string, expiresAt: Date): string {
  const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1000).toString(36);
  const nonce = randomBytes(HANDSHAKE_NONCE_BYTES).toString('base64url');
  const payload = `${HANDSHAKE_PREFIX}:${playerId}:${expiresAtSeconds}:${nonce}`;

  return `${HANDSHAKE_PREFIX}.${playerId}.${expiresAtSeconds}.${nonce}.${sign(payload)}`;
}

export function verifyHandshakeToken(token: string, now: Date = new Date()): IHandshakeTokenCheck {
  const trimmed = token.trim();

  if (trimmed === '') {
    return { valid: false, reason: 'missing_token' };
  }

  const [prefix, playerId, expiresAtSeconds, nonce, signature, ...rest] = trimmed.split('.');

  if (prefix !== HANDSHAKE_PREFIX || !playerId || !expiresAtSeconds || !nonce || !signature || rest.length > 0) {
    return { valid: false, reason: 'bad_signature' };
  }

  if (!sameSignature(sign(`${HANDSHAKE_PREFIX}:${playerId}:${expiresAtSeconds}:${nonce}`), signature)) {
    return { valid: false, reason: 'bad_signature' };
  }

  const expiresAt = new Date(parseInt(expiresAtSeconds, 36) * 1000);

  if (Number.isNaN(expiresAt.getTime()) || expiresAt.getTime() < now.getTime()) {
    return { valid: false, reason: 'expired_token', playerId, nonce, expiresAt };
  }

  return { valid: true, playerId, nonce, expiresAt };
}

export function buildHandshakeUrl(token: string): string {
  return new URL(`/h/${encodeURIComponent(token)}`, appConfig.publicBaseUrl).toString();
}
