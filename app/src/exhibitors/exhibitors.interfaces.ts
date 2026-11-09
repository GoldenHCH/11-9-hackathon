import { IAttendee, IPublicPlayer } from '../types/kubequest.interfaces';

export interface IBoothCounts {
  visits: number;
  unique: number;
  now: number;
}

export interface IBoothStats {
  byBooth: Map<string, IBoothCounts>;
  visits: number;
  unique: number;
}

export interface IHistogramBucket {
  key: number;
  doc_count: number;
}

export interface IVisitorRow {
  attendeeId: string;
  at: string;
}

export interface IVisitorProfile {
  attendee: IAttendee;
  player: IPublicPlayer;
}

export interface IDirectoryFilters {
  type?: string;
  tier?: string;
  zone?: string;
  topic?: string;
}
