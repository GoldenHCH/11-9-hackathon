import type { ILocation, IXpEvent } from '@kubequest/shared';
import { EsClientService } from '../es/es-client.service';
import { indexNames } from '../es/es.constants';
import { ResourceStoreService } from '../resources/resource-store.service';

export class XpLedgerService {
  private readonly _store: ResourceStoreService;
  private readonly _esClient: EsClientService;

  public constructor(store: ResourceStoreService, esClient: EsClientService) {
    this._store = store;
    this._esClient = esClient;
  }

  public async record(event: IXpEvent, presenceAt?: ILocation): Promise<void> {
    this._store.addXpEvent(event);

    if (presenceAt) {
      this._store.recordPresence(event.attendeeId, presenceAt, event.at);
    }

    if (this._esClient.enabled) {
      await this._mirrorToElasticsearch(event, presenceAt);
    }
  }

  public async recordPresence(attendeeId: string, location: ILocation, at: string): Promise<void> {
    this._store.recordPresence(attendeeId, location, at);

    if (!this._esClient.enabled) {
      return;
    }

    try {
      await this._esClient.updateDocument(indexNames.ATTENDEES, attendeeId, {
        lastLocation: location.geo,
        lastLocationId: location.id,
        lastSeenAt: at,
      });
    } catch (error) {
      console.error('xp ledger: could not write presence to Elasticsearch, kept it in memory', error);
    }
  }

  private async _mirrorToElasticsearch(event: IXpEvent, presenceAt?: ILocation): Promise<void> {
    const attendee = this._store.getAttendee(event.attendeeId);

    try {
      await this._esClient.indexDocument(indexNames.XP_EVENTS, event.id, event);

      if (attendee) {
        const presencePatch = presenceAt
          ? { lastLocation: presenceAt.geo, lastLocationId: presenceAt.id, lastSeenAt: event.at }
          : {};

        await this._esClient.updateDocument(indexNames.ATTENDEES, attendee.id, { xp: attendee.xp, ...presencePatch });
      }
    } catch (error) {
      console.error('xp ledger: could not write to Elasticsearch, kept the event in memory', error);
    }
  }
}
