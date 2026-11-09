import type { ConnectionSource, LinkNetwork } from './connections.types';
import type { BannerId, IsoDateString } from './kubequest.types';

export interface IProfileLinks {
  linkedin?: string;
  github?: string;
  x?: string;
  bluesky?: string;
  mastodon?: string;
  website?: string;
}

export interface ILinkItem {
  network: LinkNetwork;
  label: string;
  url: string;
}

export interface IUpdateLinksInput {
  attendeeId: string;
  links: IProfileLinks;
}

export interface ILinkEnrichment {
  network: 'github' | 'bluesky';
  status: 'added' | 'not_found' | 'unavailable';
  summary?: string;
}

export interface IUpdateLinksResult {
  links: IProfileLinks;
  items: ILinkItem[];
  enrichment: ILinkEnrichment[];
}

export interface IGetLinksInput {
  viewerId: string;
  targetPublicId: string;
}

export interface ILinksView {
  publicId: string;
  handle: string;
  isOwner: boolean;
  isConnection: boolean;
  visible: boolean;
  links: IProfileLinks;
  items: ILinkItem[];
  hiddenReason?: string;
}

export interface IConnectionPlace {
  id?: string;
  name: string;
}

export interface IStoredConnectionDetail {
  publicIds: string[];
  source: ConnectionSource;
  meetId?: string;
  handshakeId?: string;
  place?: IConnectionPlace;
  chatPrompt?: string;
  icebreaker?: string;
  sharedTopics: string[];
}

export interface IStoredConnection {
  id: string;
  kind: 'connection';
  memberIds: string[];
  metAt: IsoDateString;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  detail: IStoredConnectionDetail;
}

export interface IConnectionNote {
  talkedAbout: string;
  nextSteps: string;
  followUpBy?: IsoDateString;
  updatedAt: IsoDateString;
}

export interface IStoredConnectionNote {
  id: string;
  kind: 'connection_note';
  attendeeId: string;
  connectionId: string;
  updatedAt: IsoDateString;
  detail: IConnectionNote;
}

export interface IConnectionPlayer {
  id: string;
  handle: string;
  faceSeed: string;
  level: number;
  levelName: string;
  xp: number;
  banners: BannerId[];
  realName?: string;
  headline?: string;
  workingOn: string;
  topics: string[];
}

export interface IConnection {
  id: string;
  player: IConnectionPlayer;
  links: ILinkItem[];
  source: ConnectionSource;
  where?: IConnectionPlace;
  metAt: IsoDateString;
  chatPrompt?: string;
  sharedTopics: string[];
  note?: IConnectionNote;
}

export interface ISaveConnectionNoteInput {
  attendeeId: string;
  connectionId: string;
  talkedAbout: string;
  nextSteps: string;
  followUpBy?: IsoDateString;
}

export interface ITalkNote {
  id: string;
  talkId: string;
  talkTitle: string;
  speakers: string[];
  room?: string;
  start?: IsoDateString;
  note: string;
  takeaways: string[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface IStoredTalkNote extends ITalkNote {
  kind: 'talk_note';
  attendeeId: string;
}

export interface ISaveTalkNoteInput {
  attendeeId: string;
  talkId: string;
  note: string;
  takeaways?: string[];
}

export interface IListTalkNotesInput {
  attendeeId: string;
  talkId?: string;
}

export interface IConnectionToolContracts {
  update_links: { input: IUpdateLinksInput; output: IUpdateLinksResult };
  get_links: { input: IGetLinksInput; output: ILinksView };
  list_connections: { input: { attendeeId: string }; output: IConnection[] };
  save_connection_note: { input: ISaveConnectionNoteInput; output: IConnection };
  save_talk_note: { input: ISaveTalkNoteInput; output: ITalkNote };
  list_talk_notes: { input: IListTalkNotesInput; output: ITalkNote[] };
}
