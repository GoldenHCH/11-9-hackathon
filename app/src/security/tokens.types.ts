import type { tokenKinds, tokenRejections } from './tokens.constants';

export type TokenKind = (typeof tokenKinds)[keyof typeof tokenKinds];

export type TokenRejection = (typeof tokenRejections)[keyof typeof tokenRejections];

export type TokenVerdict = { valid: true; kind: TokenKind } | { valid: false; reason: TokenRejection };
