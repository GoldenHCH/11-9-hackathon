import { IBoothNote } from './kubequest.interfaces';
import { AiProvider, AiPurpose, BannerId, CheckInRejection, HandshakeQuestionSource, HandshakeStatus, IsoDateString, Material, NotificationType, XpEventType } from './kubequest.types';

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

export interface IHandshakeTokenCheck {
  valid: boolean;
  reason?: 'missing_token' | 'bad_signature' | 'expired_token';
  playerId?: string;
  nonce?: string;
  expiresAt?: Date;
}

export interface IHandshakeQuestion {
  question: string;
  answererQuestion: string;
  source: HandshakeQuestionSource;
  reason?: string;
}

export interface IStoredHandshake {
  id: string;
  askerId: string;
  answererId: string;
  pairKey: string;
  nonce: string;
  status: HandshakeStatus;
  question: string;
  answererQuestion: string;
  questionSource: HandshakeQuestionSource;
  questionReason?: string;
  answererAnswer?: string;
  askerPending?: string;
  askerAttempts: string[];
  sharedTopics: string[];
  firstTimerPair: boolean;
  askerXp?: number;
  answererXp?: number;
  meetId?: string;
  createdAt: IsoDateString;
  expiresAt: IsoDateString;
  matchedAt?: IsoDateString;
  closedAt?: IsoDateString;
}

export interface IStoredBoothNote extends IBoothNote {
  attendeeId: string;
  noteText?: string;
  lastScanAt?: IsoDateString;
}

export interface IStoredBoothPhoto {
  id: string;
  kind: 'photo';
  attendeeId: string;
  publicId: string;
  handle: string;
  faceSeed: string;
  locationId: string;
  boothName: string;
  image: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  caption?: string;
  createdAt: IsoDateString;
  reports: number;
  reportedBy: string[];
  hidden: boolean;
}

export interface IStoredMessage {
  id: string;
  meetId: string;
  fromId: string;
  toId: string;
  text: string;
  at: IsoDateString;
}

export interface IStoredNotification {
  kind: 'notification';
  attendeeId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  dedupeKey: string;
  createdAt: IsoDateString;
  readAt: IsoDateString | null;
}

export interface INotificationDraft {
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  dedupeKey: string;
}
