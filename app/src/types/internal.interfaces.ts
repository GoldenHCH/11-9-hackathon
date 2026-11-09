import { AiProvider, AiPurpose, BannerId, CheckInRejection, Material, XpEventType } from './kubequest.types';

export interface IAwardXpInput {
  attendeeId: string;
  type: XpEventType;
  xp: number;
  material?: Material;
  gems?: number;
  talkId?: string;
  locationId?: string;
  introId?: string;
  questId?: string;
  correct?: number;
  banner?: BannerId;
}

export interface ITokenCheck {
  valid: boolean;
  reason?: Extract<CheckInRejection, 'missing_token' | 'bad_signature' | 'expired_token'>;
  expiresAt?: Date;
}

export interface IAiResult<T> {
  value: T;
  provider: AiProvider;
  purpose: AiPurpose;
  cacheHit: boolean;
}

export interface IJsonValidator<T> {
  (value: unknown): value is T;
}

export interface IWalkPoint {
  id: string;
  building: string;
  level: string;
}
