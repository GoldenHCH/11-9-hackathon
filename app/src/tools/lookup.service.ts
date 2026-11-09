import type { IAttendee, IIntro, ILocation, ISession } from '@kubequest/shared';
import { ResourceStoreService } from '../resources/resource-store.service';
import { ToolInputError } from './tools.errors';

export class LookupService {
  private readonly _store: ResourceStoreService;

  public constructor(store: ResourceStoreService) {
    this._store = store;
  }

  public attendee(attendeeId: string): IAttendee {
    const attendee = this._store.getAttendee(attendeeId);

    if (!attendee) {
      throw new ToolInputError(`We could not find an attendee with the id "${attendeeId}".`);
    }

    return attendee;
  }

  public location(locationId: string): ILocation {
    const location = this._store.getLocation(locationId);

    if (!location) {
      throw new ToolInputError(`We could not find a location with the id "${locationId}".`);
    }

    return location;
  }

  public session(talkId: string): ISession {
    const session = this._store.getSession(talkId);

    if (!session) {
      throw new ToolInputError(`We could not find a talk with the id "${talkId}".`);
    }

    return session;
  }

  public intro(introId: string): IIntro {
    const intro = this._store.getIntro(introId);

    if (!intro) {
      throw new ToolInputError(`We could not find an intro with the id "${introId}".`);
    }

    return intro;
  }
}
