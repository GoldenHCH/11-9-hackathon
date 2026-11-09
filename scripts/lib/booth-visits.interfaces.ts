import type { IAttendee, ILocation, IXpEvent } from '../../app/src/types/kubequest.interfaces';
import type { Track } from '../../app/src/types/kubequest.types';

export interface IVisitorFocus {
  track: Track;
  clause: string;
  topics: string[];
}

export interface IVisitWindow {
  startMs: number;
  endMs: number;
  blockedMs: number[];
}

export interface IVisitorPlan {
  attendee: IAttendee;
  tracks: Set<Track>;
  visitCount: number;
  window: IVisitWindow;
  recent: boolean;
  generated: boolean;
  visitedBoothIds: Set<string>;
}

export interface IPlannedVisit {
  attendeeId: string;
  booth: ILocation;
  atMs: number;
}

export interface IBoothSeed {
  attendees: IAttendee[];
  xpEvents: IXpEvent[];
  generatedAttendees: number;
  visits: number;
}
