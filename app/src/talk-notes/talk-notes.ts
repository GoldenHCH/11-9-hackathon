import { createHash } from 'node:crypto';
import { trace } from '@opentelemetry/api';
import { esOptions, getEsClient } from '../es/client';
import { kindIs } from '../es/doc-kind.helper';
import { esTimeouts, indexNames } from '../es/es.constants';
import { getAttendee } from '../profile/attendees';
import { ToolError } from '../tools/tool-errors';
import { IListTalkNotesInput, ISaveTalkNoteInput, IStoredTalkNote, ITalkNote } from '../types/connections.interfaces';
import { docKinds } from '../types/connections.constants';
import { ITalk } from '../types/kubequest.interfaces';

const LIST_SIZE = 200;

export function talkNoteIdFor(attendeeId: string, talkId: string): string {
  return `tn-${createHash('sha256').update(`talk-note:${attendeeId}:${talkId}`).digest('hex').slice(0, 24)}`;
}

function publicTalkNote(note: IStoredTalkNote): ITalkNote {
  return {
    id: note.id,
    talkId: note.talkId,
    talkTitle: note.talkTitle,
    speakers: note.speakers,
    ...(note.room ? { room: note.room } : {}),
    ...(note.start ? { start: note.start } : {}),
    note: note.note,
    takeaways: note.takeaways,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}

async function findTalk(talkId: string): Promise<ITalk> {
  const response = await getEsClient().get<ITalk>(
    { index: indexNames.TALKS, id: talkId, _source_excludes: ['transcript', 'searchText', 'quiz', 'bossQuiz'] },
    { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] },
  );

  if (!response.found || !response._source) {
    throw new ToolError(404, 'unknown_talk', 'That talk is not on the schedule.');
  }

  return { ...response._source, id: talkId };
}

function speakersOf(talk: ITalk): string[] {
  const named = (talk.speakerDetails ?? []).map((speaker) => (speaker.company ? `${speaker.name} (${speaker.company})` : speaker.name));

  return named.length > 0 ? named : (talk.speakers ?? []);
}

async function existingNote(noteId: string): Promise<IStoredTalkNote | undefined> {
  const response = await getEsClient().get<IStoredTalkNote>(
    { index: indexNames.BOOTH_NOTES, id: noteId },
    { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] },
  );

  return response.found && response._source?.kind === docKinds.TALK_NOTE ? response._source : undefined;
}

export async function saveTalkNote(input: ISaveTalkNoteInput): Promise<ITalkNote> {
  const [attendee, talk] = await Promise.all([getAttendee(input.attendeeId), findTalk(input.talkId)]);
  const id = talkNoteIdFor(attendee.id, talk.id);
  const previous = await existingNote(id);
  const now = new Date().toISOString();
  const note: IStoredTalkNote = {
    id,
    kind: docKinds.TALK_NOTE,
    attendeeId: attendee.id,
    talkId: talk.id,
    talkTitle: talk.title,
    speakers: speakersOf(talk),
    ...(talk.room ? { room: talk.room } : {}),
    ...(talk.start ? { start: talk.start } : {}),
    note: input.note.trim(),
    takeaways: (input.takeaways ?? []).map((takeaway) => takeaway.trim()).filter((takeaway) => takeaway !== ''),
    createdAt: previous?.createdAt ?? now,
    updatedAt: now,
  };
  await getEsClient().index({ index: indexNames.BOOTH_NOTES, id, document: note, refresh: 'wait_for' }, esOptions(esTimeouts.WRITE_MS));
  trace.getActiveSpan()?.setAttributes({ 'kubequest.talk_note.id': id, 'kubequest.talk_note.takeaways': note.takeaways.length });

  return publicTalkNote(note);
}

export async function listTalkNotes(input: IListTalkNotesInput): Promise<ITalkNote[]> {
  const attendee = await getAttendee(input.attendeeId);
  const response = await getEsClient().search<IStoredTalkNote>(
    {
      index: indexNames.BOOTH_NOTES,
      size: LIST_SIZE,
      query: {
        bool: {
          filter: [kindIs(docKinds.TALK_NOTE), { term: { attendeeId: attendee.id } }, ...(input.talkId ? [{ term: { talkId: input.talkId } }] : [])],
        },
      },
      sort: [{ updatedAt: { order: 'desc' } }],
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );
  const notes = (response.hits?.hits ?? []).flatMap((hit) => (hit._source && hit._id ? [publicTalkNote({ ...hit._source, id: hit._id })] : []));
  trace.getActiveSpan()?.setAttribute('kubequest.talk_note.count', notes.length);

  return notes;
}
