import { createHmac, timingSafeEqual } from 'node:crypto';
import { tokenKinds, tokenRejections, tokenSettings } from './tokens.constants';
import type { TokenVerdict } from './tokens.types';

export class TokensHelper {
  public static signLocation(secret: string, locationId: string): string {
    return TokensHelper._hmac(secret, locationId);
  }

  public static signScreen(secret: string, locationId: string, exp: number): string {
    return `${exp}${tokenSettings.SEPARATOR}${TokensHelper._hmac(secret, TokensHelper._screenPayload(locationId, exp))}`;
  }

  public static verify(secret: string, locationId: string, token: string, nowSeconds: number): TokenVerdict {
    const parts = token.split(tokenSettings.SEPARATOR);

    if (parts.length === 1) {
      return TokensHelper._verifyLocation(secret, locationId, parts[0]);
    }

    if (parts.length === 2) {
      return TokensHelper._verifyScreen(secret, locationId, parts[0], parts[1], nowSeconds);
    }

    return { valid: false, reason: tokenRejections.MALFORMED };
  }

  private static _verifyLocation(secret: string, locationId: string, signature: string): TokenVerdict {
    if (!tokenSettings.SIGNATURE_PATTERN.test(signature)) {
      return { valid: false, reason: tokenRejections.MALFORMED };
    }

    if (!TokensHelper._sameSignature(signature, TokensHelper._hmac(secret, locationId))) {
      return { valid: false, reason: tokenRejections.BAD_SIGNATURE };
    }

    return { valid: true, kind: tokenKinds.LOCATION };
  }

  private static _verifyScreen(
    secret: string,
    locationId: string,
    expiry: string,
    signature: string,
    nowSeconds: number,
  ): TokenVerdict {
    if (!tokenSettings.EXPIRY_PATTERN.test(expiry) || !tokenSettings.SIGNATURE_PATTERN.test(signature)) {
      return { valid: false, reason: tokenRejections.MALFORMED };
    }

    const exp = Number(expiry);
    const expected = TokensHelper._hmac(secret, TokensHelper._screenPayload(locationId, exp));

    if (!TokensHelper._sameSignature(signature, expected)) {
      return { valid: false, reason: tokenRejections.BAD_SIGNATURE };
    }

    if (exp <= nowSeconds) {
      return { valid: false, reason: tokenRejections.EXPIRED };
    }

    return { valid: true, kind: tokenKinds.SCREEN };
  }

  private static _screenPayload(locationId: string, exp: number): string {
    return `${locationId}${tokenSettings.SEPARATOR}${exp}`;
  }

  private static _hmac(secret: string, payload: string): string {
    return createHmac(tokenSettings.HMAC_ALGORITHM, secret).update(payload, 'utf8').digest('base64url');
  }

  private static _sameSignature(given: string, expected: string): boolean {
    const givenBytes = Buffer.from(given, 'utf8');
    const expectedBytes = Buffer.from(expected, 'utf8');

    if (givenBytes.length !== expectedBytes.length) {
      return false;
    }

    return timingSafeEqual(givenBytes, expectedBytes);
  }
}
