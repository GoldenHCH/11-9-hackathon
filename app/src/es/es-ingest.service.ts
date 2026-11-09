import type { IndexName } from '@kubequest/shared';
import { ResourceStoreService } from '../resources/resource-store.service';
import { EsClientService } from './es-client.service';
import { EsDocumentsHelper } from './es-documents.helper';
import { EsIndicesService } from './es-indices.service';
import { allIndexNames, esTimeouts, indexNames } from './es.constants';
import type { IBulkDocument } from './es.interfaces';
import type { IIngestSummary } from './es-ingest.interfaces';
import type { IngestProgress } from './es-ingest.types';

export class EsIngestService {
  private readonly _esClient: EsClientService;
  private readonly _store: ResourceStoreService;
  private readonly _indices: EsIndicesService;

  public constructor(esClient: EsClientService, store: ResourceStoreService, indices: EsIndicesService) {
    this._esClient = esClient;
    this._store = store;
    this._indices = indices;
  }

  public async indexAll(batchSize: number, onProgress: IngestProgress): Promise<IIngestSummary[]> {
    await this._indices.ensureIndices(esTimeouts.BULK_MS);

    const documentsByIndex = this._buildDocuments();
    const summaries: IIngestSummary[] = [];

    for (const indexName of allIndexNames) {
      const documents = documentsByIndex[indexName];
      const summary: IIngestSummary = { index: indexName, sent: documents.length, indexed: 0, failed: 0, total: 0 };

      for (let start = 0; start < documents.length; start += batchSize) {
        const result = await this._esClient.bulkIndex(indexName, documents.slice(start, start + batchSize), esTimeouts.BULK_MS);

        summary.indexed += result.indexed;
        summary.failed += result.failed;
        summary.firstError = summary.firstError ?? result.firstError;
        onProgress(indexName, Math.min(start + batchSize, documents.length), documents.length);
      }

      await this._esClient.refresh(indexName, esTimeouts.BULK_MS);
      summary.total = await this._esClient.count(indexName, esTimeouts.BULK_MS);
      summaries.push(summary);
    }

    return summaries;
  }

  private _buildDocuments(): Record<IndexName, IBulkDocument[]> {
    const locationsById = new Map(this._store.getLocations().map((location) => [location.id, location]));

    return {
      [indexNames.TALKS]: this._store.getSessions().map((session) => ({
        id: session.id,
        body: EsDocumentsHelper.talkDocument(session, locationsById.get(session.locationId), this._store.readTranscript(session.id)),
      })),
      [indexNames.ATTENDEES]: this._store
        .getAttendees()
        .map((attendee) => ({ id: attendee.id, body: EsDocumentsHelper.attendeeDocument(attendee) })),
      [indexNames.LOCATIONS]: this._store
        .getLocations()
        .map((location) => ({ id: location.id, body: EsDocumentsHelper.locationDocument(location) })),
      [indexNames.XP_EVENTS]: this._store.getXpEvents().map((event) => ({ id: event.id, body: event })),
      [indexNames.INTROS]: this._store.getIntros().map((intro) => ({ id: intro.id, body: intro })),
    };
  }
}
