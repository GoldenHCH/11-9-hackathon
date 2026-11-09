import { createHash } from 'node:crypto';
import { trace } from '@opentelemetry/api';
import { appConfig } from '../config';
import { countOutpostsToday, findAttendee, findLocation } from '../checkin/lookups';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { isConflict } from '../meet/meet.store';
import { logger } from '../observability/logger';
import { kubequestMetrics } from '../observability/metrics';
import { ToolError } from '../tools/tool-errors';
import { gameRules, xpRewards } from '../types/kubequest.constants';
import { IStoredBoothNote } from '../types/internal.interfaces';
import { IBoothNote, ILocation, ISaveBoothNoteInput, ISaveBoothNoteResult, IXpEvent } from '../types/kubequest.interfaces';
import { awardXpOnceDetailed } from '../xp/award';

interface IVersionedNote {
  note: IStoredBoothNote;
  seqNo: number;
  primaryTerm: number;
}

interface IXpDecision {
  award: boolean;
  message: string;
}

const MINUTE_MS = 60_000;

export function boothNoteIdFor(attendeeId: string, locationId: string): string {
  return `bn-${createHash('sha256').update(`booth-note:${attendeeId}:${locationId}`).digest('hex').slice(0, 24)}`;
}

export function publicBoothNote(note: IStoredBoothNote): IBoothNote {
  return {
    id: note.id,
    locationId: note.locationId,
    boothName: note.boothName,
    ...(note.boothNumber ? { boothNumber: note.boothNumber } : {}),
    ...(note.sponsorTier ? { sponsorTier: note.sponsorTier } : {}),
    liked: note.liked,
    ...(note.thoughts ? { thoughts: note.thoughts } : {}),
    followUp: note.followUp,
    xpAwarded: note.xpAwarded,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

function emptyNote(attendeeId: string, location: ILocation, at: string): IStoredBoothNote {
  return {
    id: boothNoteIdFor(attendeeId, location.id),
    attendeeId,
    locationId: location.id,
    boothName: location.name,
    ...(location.boothNumber ? { boothNumber: location.boothNumber } : {}),
    ...(location.sponsorTier ? { sponsorTier: location.sponsorTier } : {}),
    liked: '',
    followUp: false,
    xpAwarded: 0,
    createdAt: at,
    updatedAt: at,
  };
}

async function getNote(noteId: string): Promise<IVersionedNote | undefined> {
  const response = await getEsClient().get<IStoredBoothNote>(
    { index: indexNames.BOOTH_NOTES, id: noteId, _source_excludes: ['noteText'] },
    { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] },
  );

  if (!response.found || !response._source || response._seq_no === undefined || response._primary_term === undefined) {
    return undefined;
  }

  return { note: { ...response._source, id: noteId }, seqNo: response._seq_no, primaryTerm: response._primary_term };
}

async function writeNote(note: IStoredBoothNote, previous?: IVersionedNote): Promise<void> {
  const fields: Partial<IStoredBoothNote> = { ...note };
  delete fields.noteText;

  if (!previous) {
    await getEsClient().index(
      { index: indexNames.BOOTH_NOTES, id: note.id, document: fields, op_type: 'create', refresh: true },
      esOptions(esTimeouts.WRITE_MS),
    );

    return;
  }

  await getEsClient().index(
    {
      index: indexNames.BOOTH_NOTES,
      id: note.id,
      document: fields,
      if_seq_no: previous.seqNo,
      if_primary_term: previous.primaryTerm,
      refresh: true,
    },
    esOptions(esTimeouts.WRITE_MS),
  );
}

function noteTextFor(note: IStoredBoothNote): string {
  return [note.boothName, note.liked, note.thoughts ?? ''].filter((part) => part.trim() !== '').join('. ');
}

function embedInBackground(note: IStoredBoothNote): void {
  const noteText = noteTextFor(note);

  if (note.liked.trim() === '' && (note.thoughts ?? '').trim() === '') {
    return;
  }

  getEsClient()
    .update({ index: indexNames.BOOTH_NOTES, id: note.id, doc: { noteText } }, esOptions(esTimeouts.INFERENCE_MS))
    .catch((error: unknown) => logger.warn({ err: error, noteId: note.id }, 'booth note embedding skipped'));
}

async function markScanned(noteId: string, scannedAt: string): Promise<void> {
  try {
    await getEsClient().update(
      { index: indexNames.BOOTH_NOTES, id: noteId, doc: { lastScanAt: scannedAt }, refresh: true },
      esOptions(esTimeouts.WRITE_MS),
    );
  } catch (error) {
    logger.warn({ err: error, noteId }, 'booth scan time not recorded');
  }
}

export async function lastBoothScanAt(attendeeId: string, locationId: string): Promise<string | undefined> {
  const response = await getEsClient().get<IStoredBoothNote>(
    { index: indexNames.BOOTH_NOTES, id: boothNoteIdFor(attendeeId, locationId), _source_includes: ['lastScanAt'] },
    { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] },
  );

  return response.found ? response._source?.lastScanAt : undefined;
}

export async function openBoothNote(attendeeId: string, location: ILocation): Promise<{ note: IBoothNote; created: boolean }> {
  const noteId = boothNoteIdFor(attendeeId, location.id);
  const existing = await getNote(noteId);

  const scannedAt = new Date().toISOString();

  if (existing) {
    await markScanned(noteId, scannedAt);

    return { note: publicBoothNote(existing.note), created: false };
  }

  const note: IStoredBoothNote = { ...emptyNote(attendeeId, location, scannedAt), lastScanAt: scannedAt };

  try {
    await writeNote(note);
  } catch (error) {
    if (!isConflict(error)) {
      throw error;
    }

    const raced = await getNote(noteId);

    if (raced) {
      return { note: publicBoothNote(raced.note), created: false };
    }
  }

  return { note: publicBoothNote(note), created: true };
}

async function lastOutpostXp(attendeeId: string): Promise<IXpEvent | undefined> {
  const response = await getEsClient().search<IXpEvent>(
    {
      index: indexNames.XP_EVENTS,
      size: 1,
      query: { bool: { filter: [{ term: { attendeeId } }, { term: { type: 'outpost' } }] } },
      sort: [{ at: { order: 'desc' } }],
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return response.hits?.hits[0]?._source;
}

async function decideXp(note: IStoredBoothNote, previous: IVersionedNote | undefined, now: Date): Promise<IXpDecision> {
  const boothName = note.boothName;

  if (previous && previous.note.xpAwarded > 0) {
    return { award: false, message: `Saved. You already earned XP for ${boothName}.` };
  }

  const length = note.liked.trim().length + (note.thoughts ?? '').trim().length;

  if (length < gameRules.BOOTH_NOTE_MIN_CHARS) {
    return {
      award: false,
      message: `Saved. Write a little more about what you liked at ${boothName} (at least ${gameRules.BOOTH_NOTE_MIN_CHARS} characters) to earn ${xpRewards.OUTPOST} XP.`,
    };
  }

  if ((await countOutpostsToday(note.attendeeId, appConfig.conferenceTimeZone)) >= gameRules.OUTPOSTS_PER_DAY) {
    return {
      award: false,
      message: `Saved. You've earned booth XP ${gameRules.OUTPOSTS_PER_DAY} times today, the daily limit. This note still goes in your summary.`,
    };
  }

  const last = await lastOutpostXp(note.attendeeId);
  const minutesSince = last ? (now.getTime() - Date.parse(last.at)) / MINUTE_MS : Number.POSITIVE_INFINITY;

  if (minutesSince < gameRules.BOOTH_XP_GAP_MINUTES) {
    const wait = Math.max(1, Math.ceil(gameRules.BOOTH_XP_GAP_MINUTES - minutesSince));

    return {
      award: false,
      message: `Take a few minutes at each booth. Your note is saved; save it again in ${wait} ${wait === 1 ? 'minute' : 'minutes'} to earn ${xpRewards.OUTPOST} XP.`,
    };
  }

  return { award: true, message: `+${xpRewards.OUTPOST} XP for your note on ${boothName}. It's in your summary.` };
}

async function outpostFor(locationId: string): Promise<ILocation> {
  const location = await findLocation(locationId);

  if (!location || location.kind !== 'outpost') {
    throw new ToolError(404, 'unknown_outpost', 'That booth is not in the game. Scan the code at the booth first.');
  }

  return { ...location, id: location.id ?? locationId };
}

async function saveOnce(input: ISaveBoothNoteInput, location: ILocation): Promise<{ note: IStoredBoothNote; decision: IXpDecision }> {
  const now = new Date();
  const at = now.toISOString();
  const previous = await getNote(boothNoteIdFor(input.attendeeId, location.id));
  const base = previous?.note ?? emptyNote(input.attendeeId, location, at);
  const thoughts = input.thoughts?.trim() ?? '';
  const edited: IStoredBoothNote = {
    ...base,
    liked: input.liked.trim(),
    followUp: input.followUp ?? base.followUp,
    updatedAt: at,
  };

  if (thoughts !== '') {
    edited.thoughts = thoughts;
  } else {
    delete edited.thoughts;
  }

  const decision = await decideXp(edited, previous, now);
  const note: IStoredBoothNote = { ...edited, xpAwarded: decision.award ? xpRewards.OUTPOST : base.xpAwarded };
  await writeNote(note, previous);

  return { note, decision };
}

export async function saveBoothNote(input: ISaveBoothNoteInput): Promise<ISaveBoothNoteResult> {
  if (!(await findAttendee(input.attendeeId))) {
    throw new ToolError(404, 'unknown_attendee', 'Sign up first, then scan the code again.');
  }

  const location = await outpostFor(input.locationId);
  let saved: { note: IStoredBoothNote; decision: IXpDecision } | undefined;

  for (let attempt = 0; attempt < 2 && !saved; attempt += 1) {
    try {
      saved = await saveOnce(input, location);
    } catch (error) {
      if (!isConflict(error) || attempt > 0) {
        throw error;
      }
    }
  }

  if (!saved) {
    throw new ToolError(409, 'conflict', 'That note changed while we saved it. Try again.');
  }

  embedInBackground(saved.note);
  const outcome = saved.decision.award
    ? await awardXpOnceDetailed(
        { attendeeId: input.attendeeId, type: 'outpost', xp: xpRewards.OUTPOST, locationId: location.id },
        `booth-note-${input.attendeeId}-${location.id}`,
      )
    : undefined;
  const xpAwarded = outcome?.event.xp ?? 0;

  kubequestMetrics().boothNotes.add(1, { 'kubequest.booth_note.earned_xp': xpAwarded > 0, 'kubequest.location.id': location.id });
  trace.getActiveSpan()?.setAttributes({
    'kubequest.booth_note.id': saved.note.id,
    'kubequest.booth_note.chars': saved.note.liked.length + (saved.note.thoughts?.length ?? 0),
    'kubequest.booth_note.follow_up': saved.note.followUp,
  });

  return {
    note: publicBoothNote(saved.note),
    xpAwarded,
    message: saved.decision.message,
    ...(outcome?.levelUp ? { levelUp: outcome.levelUp } : {}),
    newBanners: outcome?.newBanners ?? [],
  };
}

export async function listBoothNotes(attendeeId: string): Promise<IBoothNote[]> {
  if (!(await findAttendee(attendeeId))) {
    throw new ToolError(404, 'unknown_attendee', 'We could not find that player. Open your personal link or sign up again.');
  }

  const response = await getEsClient().search<IStoredBoothNote>(
    {
      index: indexNames.BOOTH_NOTES,
      size: 200,
      query: { bool: { filter: [{ term: { attendeeId } }], must_not: [{ term: { kind: 'photo' } }] } },
      sort: [{ updatedAt: { order: 'desc' } }],
      _source: { excludes: ['noteText'] },
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );
  const notes = (response.hits?.hits ?? []).flatMap((hit) => (hit._source && hit._id ? [publicBoothNote({ ...hit._source, id: hit._id })] : []));
  trace.getActiveSpan()?.setAttribute('kubequest.booth_note.count', notes.length);

  return notes;
}
