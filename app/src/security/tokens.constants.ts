export const tokenSettings = {
  SCREEN_TOKEN_TTL_SECONDS: 600,
  SEPARATOR: '.',
  HMAC_ALGORITHM: 'sha256',
  SIGNATURE_PATTERN: /^[A-Za-z0-9_-]{43}$/,
  EXPIRY_PATTERN: /^\d{1,12}$/,
} as const;

export const tokenKinds = {
  LOCATION: 'location',
  SCREEN: 'screen',
} as const;

export const tokenRejections = {
  MALFORMED: 'malformed',
  BAD_SIGNATURE: 'bad_signature',
  EXPIRED: 'expired',
} as const;
