import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAttendee, IIntro, ILocation, ISeedMeta, ISession, IXpEvent } from '@kubequest/shared';
import { resourceFiles, transcriptsDirName } from './resource.constants';
import type { IResourceBundle } from './resource.interfaces';

export class ResourceStoreService {
  private readonly _resourcesDir: string;
  private readonly _seedNowOverride?: string;
  private _bundle?: IResourceBundle;

  public constructor(resourcesDir: string, seedNowOverride?: string) {
    this._resourcesDir = resourcesDir;
    this._seedNowOverride = seedNowOverride;
  }

  public getSessions(): ISession[] {
    return this._load().sessions;
  }

  public getSession(sessionId: string): ISession | undefined {
    return this._load().sessions.find((session) => session.id === sessionId);
  }

  public getLocations(): ILocation[] {
    return this._load().locations;
  }

  public getLocation(locationId: string): ILocation | undefined {
    return this._load().locations.find((location) => location.id === locationId);
  }

  public getAttendees(): IAttendee[] {
    return this._load().attendees;
  }

  public getAttendee(attendeeId: string): IAttendee | undefined {
    return this._load().attendees.find((attendee) => attendee.id === attendeeId);
  }

  public getXpEvents(): IXpEvent[] {
    return this._load().xpEvents;
  }

  public getIntros(): IIntro[] {
    return this._load().intros;
  }

  public getIntro(introId: string): IIntro | undefined {
    return this._load().intros.find((intro) => intro.id === introId);
  }

  public getSeedMeta(): ISeedMeta | undefined {
    return this._load().seedMeta;
  }

  public now(): Date {
    const candidates = [this._seedNowOverride, this._load().seedMeta?.seedNow];

    for (const candidate of candidates) {
      if (candidate && !Number.isNaN(Date.parse(candidate))) {
        return new Date(candidate);
      }
    }

    return new Date();
  }

  public addXpEvent(event: IXpEvent): void {
    const bundle = this._load();
    const attendee = bundle.attendees.find((entry) => entry.id === event.attendeeId);

    bundle.xpEvents.push(event);

    if (attendee) {
      attendee.xp += event.xp;
    }
  }

  public recordPresence(attendeeId: string, location: ILocation, at: string): void {
    const attendee = this.getAttendee(attendeeId);

    if (attendee) {
      attendee.lastLocation = { ...location.geo };
      attendee.lastLocationId = location.id;
      attendee.lastSeenAt = at;
    }
  }

  public addIntro(intro: IIntro): void {
    this._load().intros.push(intro);
  }

  public readTranscript(talkId: string): string | undefined {
    const transcriptPath = path.join(this._resourcesDir, transcriptsDirName, `${path.basename(talkId)}.md`);

    return fs.existsSync(transcriptPath) ? fs.readFileSync(transcriptPath, 'utf8') : undefined;
  }

  private _load(): IResourceBundle {
    if (!this._bundle) {
      this._bundle = {
        sessions: this._readJson<ISession[]>(resourceFiles.SESSIONS, []),
        locations: this._readJson<ILocation[]>(resourceFiles.LOCATIONS, []),
        attendees: this._readJson<IAttendee[]>(resourceFiles.ATTENDEES, []),
        xpEvents: this._readJson<IXpEvent[]>(resourceFiles.XP_EVENTS, []),
        intros: this._readJson<IIntro[]>(resourceFiles.INTROS, []),
        seedMeta: this._readJson<ISeedMeta | undefined>(resourceFiles.SEED_META, undefined),
      };
    }

    return this._bundle;
  }

  private _readJson<T>(fileName: string, fallback: T): T {
    const filePath = path.join(this._resourcesDir, fileName);

    if (!fs.existsSync(filePath)) {
      console.warn(`resources: ${fileName} not found in ${this._resourcesDir}, using an empty default`);

      return fallback;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
  }
}
