import '../config/load-env';
import type { IScreenToken } from '@kubequest/shared';
import { ConfigHelper } from '../config/config.helper';
import { tokenSettings } from './tokens.constants';
import { TokensHelper } from './tokens.helper';
import type { TokenVerdict } from './tokens.types';

function qrSecret(): string {
  const secret = ConfigHelper.nonEmpty(process.env.QR_SECRET);

  if (!secret) {
    throw new Error('QR_SECRET is not set, so QR tokens cannot be signed or verified.');
  }

  return secret;
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function signLocationToken(locationId: string): string {
  return TokensHelper.signLocation(qrSecret(), locationId);
}

export function signScreenToken(locationId: string, exp: number): string {
  return TokensHelper.signScreen(qrSecret(), locationId, exp);
}

export function mintScreenToken(locationId: string): IScreenToken {
  const exp = nowSeconds() + tokenSettings.SCREEN_TOKEN_TTL_SECONDS;

  return { locationId, token: signScreenToken(locationId, exp), exp };
}

export function verifyToken(locationId: string, token: string): TokenVerdict {
  return TokensHelper.verify(qrSecret(), locationId, token, nowSeconds());
}
