import { randomUUID } from 'node:crypto';
import { trace } from '@opentelemetry/api';
import type { estypes } from '@elastic/elasticsearch';
import { appConfig } from '../config';
import { lastBoothScanAt } from '../booth/booth-notes';
import { findAttendee, findLocation } from '../checkin/lookups';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { publicIdFor } from '../profile/public-id';
import { completeQuestsFor } from '../quests/complete';
import { ToolError } from '../tools/tool-errors';
import { gameRules, xpRewards } from '../types/kubequest.constants';
import { IStoredBoothPhoto } from '../types/internal.interfaces';
import {
  IAttendee,
  IBoothPhoto,
  IBoothPhotoActionInput,
  IBoothPhotoList,
  IDeleteBoothPhotoResult,
  IListBoothPhotosInput,
  ILocation,
  IQuest,
  IReportBoothPhotoResult,
  IUploadBoothPhotoInput,
  IUploadBoothPhotoResult,
  IXpEvent,
} from '../types/kubequest.interfaces';
import { awardXpOnceDetailed } from '../xp/award';
import { decodePhoto } from './photo-image';

export interface IPhotoImage {
  body: Buffer;
  mimeType: string;
}

const MINUTE_MS = 60_000;
const DEFAULT_LIST_LIMIT = 12;
const MAX_LIST_LIMIT = 30;
const photoIdPattern = /^bp-[a-f0-9]{24}$/;
const listFields = ['id', 'kind', 'publicId', 'handle', 'faceSeed', 'locationId', 'boothName', 'width', 'height', 'caption', 'createdAt', 'attendeeId'];

const reportScript = [
  'if (ctx._source.reportedBy == null) { ctx._source.reportedBy = new ArrayList(); }',
  'if (ctx._source.reportedBy.contains(params.reporter)) { ctx.op = "noop"; } else {',
  '  ctx._source.reportedBy.add(params.reporter);',
  '  ctx._source.reports = (ctx._source.reports == null ? 0 : ctx._source.reports) + 1;',
  '  if (ctx._source.reports >= params.limit) { ctx._source.hidden = true; }',
  '}',
].join('\n');

export function isBoothPhotoId(id: string): boolean {
  return photoIdPattern.test(id);
}

export function boothPhotoUrl(photoId: string): string {
  return `/api/booth-photos/${photoId}.jpg`;
}

function visiblePhotoFilter(locationId?: string): estypes.QueryDslQueryContainer[] {
  return [{ term: { kind: 'photo' } }, { term: { hidden: false } }, ...(locationId ? [{ term: { locationId } }] : [])];
}

function publicPhoto(photo: Omit<IStoredBoothPhoto, 'image'>, viewerId?: string): IBoothPhoto {
  return {
    id: photo.id,
    locationId: photo.locationId,
    boothName: photo.boothName,
    url: boothPhotoUrl(photo.id),
    width: photo.width,
    height: photo.height,
    ...(photo.caption ? { caption: photo.caption } : {}),
    uploader: { publicId: photo.publicId, handle: photo.handle, faceSeed: photo.faceSeed },
    createdAt: photo.createdAt,
    ...(viewerId ? { mine: photo.attendeeId === viewerId } : {}),
  };
}

function faceSeedOf(attendee: IAttendee): string {
  return attendee.faceSeed && attendee.faceSeed !== attendee.id ? attendee.faceSeed : attendee.handle;
}

async function requireAttendee(attendeeId: string): Promise<IAttendee> {
  const attendee = await findAttendee(attendeeId);

  if (!attendee) {
    throw new ToolError(404, 'unknown_attendee', 'We could not find that player. Open your personal link or sign up again.');
  }

  return attendee;
}

async function requireOutpost(locationId: string): Promise<ILocation> {
  const location = await findLocation(locationId);

  if (!location || location.kind !== 'outpost') {
    throw new ToolError(404, 'unknown_outpost', 'That booth is not in the game.');
  }

  return { ...location, id: location.id ?? locationId };
}

async function recentCheckInAt(attendeeId: string, locationId: string, since: Date): Promise<boolean> {
  const response = await getEsClient().count(
    {
      index: indexNames.XP_EVENTS,
      query: {
        bool: {
          filter: [{ term: { attendeeId } }, { term: { locationId } }, { terms: { type: ['check_in', 'outpost'] } }, { range: { at: { gte: since.toISOString() } } }],
        },
      },
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return (response.count ?? 0) > 0;
}

async function wasHereRecently(attendeeId: string, locationId: string, now: Date): Promise<boolean> {
  const since = new Date(now.getTime() - gameRules.PHOTO_PRESENCE_MINUTES * MINUTE_MS);
  const [scannedAt, checkedIn] = await Promise.all([lastBoothScanAt(attendeeId, locationId), recentCheckInAt(attendeeId, locationId, since)]);

  return checkedIn || (scannedAt !== undefined && Date.parse(scannedAt) >= since.getTime());
}

async function countPhotos(filter: estypes.QueryDslQueryContainer[]): Promise<number> {
  const response = await getEsClient().count(
    { index: indexNames.BOOTH_NOTES, query: { bool: { filter: [{ term: { kind: 'photo' } }, ...filter] } } },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return response.count ?? 0;
}

async function enforceLimits(attendeeId: string, location: ILocation): Promise<void> {
  const [atBooth, today] = await Promise.all([
    countPhotos([{ term: { attendeeId } }, { term: { locationId: location.id } }]),
    countPhotos([{ term: { attendeeId } }, { range: { createdAt: { gte: 'now/d', time_zone: appConfig.conferenceTimeZone } } }]),
  ]);

  if (atBooth >= gameRules.PHOTOS_PER_BOOTH) {
    throw new ToolError(429, 'photo_limit_booth', `You already added ${gameRules.PHOTOS_PER_BOOTH} photos of ${location.name}. Delete one to add another.`);
  }

  if (today >= gameRules.PHOTOS_PER_DAY) {
    throw new ToolError(429, 'photo_limit_day', `You added ${gameRules.PHOTOS_PER_DAY} photos today, the daily limit.`);
  }
}

async function completeWithoutXp(attendeeId: string, locationId: string): Promise<IQuest[]> {
  const event: IXpEvent = { id: `photo-${attendeeId}-${locationId}`, attendeeId, type: 'photo', xp: 0, locationId, at: new Date().toISOString() };

  return completeQuestsFor(event);
}

export async function uploadBoothPhoto(input: IUploadBoothPhotoInput, now: Date = new Date()): Promise<IUploadBoothPhotoResult> {
  const attendee = await requireAttendee(input.attendeeId);
  const location = await requireOutpost(input.locationId);

  if (!(await wasHereRecently(attendee.id, location.id, now))) {
    throw new ToolError(
      403,
      'not_at_booth',
      `Scan the QR code at ${location.name} first. Photos count only within ${gameRules.PHOTO_PRESENCE_MINUTES} minutes of a scan there.`,
    );
  }

  await enforceLimits(attendee.id, location);
  const decoded = decodePhoto(input.image);
  const caption = input.caption?.trim().slice(0, gameRules.PHOTO_CAPTION_MAX_CHARS) ?? '';
  const stored: IStoredBoothPhoto = {
    id: `bp-${randomUUID().replace(/-/g, '').slice(0, 24)}`,
    kind: 'photo',
    attendeeId: attendee.id,
    publicId: publicIdFor(attendee.id),
    handle: attendee.handle,
    faceSeed: faceSeedOf(attendee),
    locationId: location.id,
    boothName: location.name,
    image: decoded.base64,
    mimeType: decoded.mimeType,
    width: decoded.width,
    height: decoded.height,
    bytes: decoded.bytes,
    ...(caption !== '' ? { caption } : {}),
    createdAt: now.toISOString(),
    reports: 0,
    reportedBy: [],
    hidden: false,
  };

  await getEsClient().index(
    { index: indexNames.BOOTH_NOTES, id: stored.id, document: stored, op_type: 'create', refresh: 'wait_for' },
    esOptions(esTimeouts.WRITE_MS),
  );

  const outcome = await awardXpOnceDetailed(
    { attendeeId: attendee.id, type: 'photo', xp: xpRewards.PHOTO, locationId: location.id },
    `photo-${attendee.id}-${location.id}`,
  );
  const completed = outcome ? outcome.completedQuests : await completeWithoutXp(attendee.id, location.id).catch(() => []);
  const questCompleted = completed.some((quest) => quest.type === 'photo' && quest.locationId === location.id);
  const xp = outcome?.event.xp ?? 0;

  trace.getActiveSpan()?.setAttributes({
    'kubequest.booth_photo.id': stored.id,
    'kubequest.booth_photo.bytes': stored.bytes,
    'kubequest.booth_photo.quest_completed': questCompleted,
  });

  return {
    photo: publicPhoto(stored, attendee.id),
    xp,
    questCompleted,
    message: xp > 0 ? `+${xp} XP · photo added to the ${location.name} booth on the map` : `Photo added to the ${location.name} booth on the map. You already earned XP here.`,
    ...(outcome?.levelUp ? { levelUp: outcome.levelUp } : {}),
    newBanners: outcome?.newBanners ?? [],
  };
}

export async function listBoothPhotos(input: IListBoothPhotosInput): Promise<IBoothPhotoList> {
  const size = Math.min(MAX_LIST_LIMIT, Math.max(1, input.limit ?? DEFAULT_LIST_LIMIT));
  const response = await getEsClient().search<Omit<IStoredBoothPhoto, 'image'>>(
    {
      index: indexNames.BOOTH_NOTES,
      size,
      track_total_hits: true,
      query: { bool: { filter: visiblePhotoFilter(input.locationId) } },
      sort: [{ createdAt: { order: 'desc' } }],
      _source: { includes: listFields },
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );
  const hits = response.hits?.hits ?? [];
  const photos = hits.flatMap((hit) => (hit._source && hit._id ? [publicPhoto({ ...hit._source, id: hit._id }, input.attendeeId)] : []));
  const total = response.hits?.total;
  const count = typeof total === 'number' ? total : (total?.value ?? photos.length);
  trace.getActiveSpan()?.setAttribute('kubequest.booth_photo.count', count);

  return { locationId: input.locationId, photos, count };
}

async function loadPhoto(photoId: string, fields: string[]): Promise<Partial<IStoredBoothPhoto> | undefined> {
  if (!isBoothPhotoId(photoId)) {
    return undefined;
  }

  const response = await getEsClient().get<Partial<IStoredBoothPhoto>>(
    { index: indexNames.BOOTH_NOTES, id: photoId, _source_includes: ['kind', ...fields] },
    { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] },
  );

  return response.found && response._source?.kind === 'photo' ? response._source : undefined;
}

export async function reportBoothPhoto(input: IBoothPhotoActionInput): Promise<IReportBoothPhotoResult> {
  await requireAttendee(input.attendeeId);
  const photo = await loadPhoto(input.photoId, ['attendeeId']);

  if (!photo) {
    throw new ToolError(404, 'unknown_photo', 'That photo is gone.');
  }

  if (photo.attendeeId === input.attendeeId) {
    throw new ToolError(409, 'own_photo', 'This is your photo. Delete it instead.');
  }

  const response = await getEsClient().update<IStoredBoothPhoto, Partial<IStoredBoothPhoto>, IStoredBoothPhoto>(
    {
      index: indexNames.BOOTH_NOTES,
      id: input.photoId,
      script: { lang: 'painless', source: reportScript, params: { reporter: input.attendeeId, limit: gameRules.PHOTO_REPORTS_TO_HIDE } },
      _source: ['reports', 'hidden'],
      refresh: true,
      retry_on_conflict: 3,
    },
    esOptions(esTimeouts.WRITE_MS),
  );
  const reports = response.get?._source?.reports ?? 0;
  const hidden = response.get?._source?.hidden ?? false;
  trace.getActiveSpan()?.setAttributes({ 'kubequest.booth_photo.id': input.photoId, 'kubequest.booth_photo.hidden': hidden });

  return { photoId: input.photoId, reports, hidden, message: hidden ? 'Thanks. That photo is hidden now.' : 'Thanks. We noted your report.' };
}

export async function deleteBoothPhoto(input: IBoothPhotoActionInput): Promise<IDeleteBoothPhotoResult> {
  const photo = await loadPhoto(input.photoId, ['attendeeId']);

  if (!photo || photo.attendeeId !== input.attendeeId) {
    throw new ToolError(404, 'unknown_photo', 'You can only delete your own photos.');
  }

  await getEsClient().delete({ index: indexNames.BOOTH_NOTES, id: input.photoId, refresh: true }, esOptions(esTimeouts.WRITE_MS));
  trace.getActiveSpan()?.setAttribute('kubequest.booth_photo.id', input.photoId);

  return { photoId: input.photoId, deleted: true };
}

export async function boothPhotoImage(photoId: string): Promise<IPhotoImage | undefined> {
  const photo = await loadPhoto(photoId, ['image', 'mimeType', 'hidden']);

  if (!photo || photo.hidden || !photo.image) {
    return undefined;
  }

  return { body: Buffer.from(photo.image, 'base64'), mimeType: photo.mimeType ?? 'image/jpeg' };
}

export async function visiblePhotoCounts(locationIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>(locationIds.map((id) => [id, 0]));

  if (locationIds.length === 0) {
    return counts;
  }

  const response = await getEsClient().search(
    {
      index: indexNames.BOOTH_NOTES,
      size: 0,
      query: { bool: { filter: [...visiblePhotoFilter(), { terms: { locationId: locationIds } }] } },
      aggs: { booths: { terms: { field: 'locationId', size: locationIds.length } } },
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );
  const buckets = (response.aggregations?.['booths'] as estypes.AggregationsStringTermsAggregate | undefined)?.buckets;

  for (const bucket of Array.isArray(buckets) ? buckets : []) {
    counts.set(String(bucket.key), bucket.doc_count);
  }

  return counts;
}
