import type { IAttendee, IIntro, ILocation, ISeedMeta, ISession, IXpEvent } from '@kubequest/shared';

export interface IResourceBundle {
  sessions: ISession[];
  locations: ILocation[];
  attendees: IAttendee[];
  xpEvents: IXpEvent[];
  intros: IIntro[];
  seedMeta?: ISeedMeta;
}
