import { listConnections } from '../connections/connections';
import { getAttendee } from '../meet/meet.store';
import { listTalkNotes } from '../talk-notes/talk-notes';
import { IConnection } from '../types/connections.interfaces';
import { IAttendee } from '../types/kubequest.interfaces';
import { IRecapPdfData, IRecapPdfItineraryItem, IRecapPdfTalk } from './recap-pdf.interfaces';
import { buildRecap } from './recap';

const MAX_NEXT_STEPS = 6;

function textField(source: object, keys: string[]): string | undefined {
  for (const key of keys) {
    const value: unknown = Reflect.get(source, key);

    if (typeof value === 'string' && value.trim() !== '') {
      return value.trim();
    }
  }

  return undefined;
}

function itineraryOf(attendee: IAttendee): IRecapPdfItineraryItem[] {
  const raw: unknown = Reflect.get(attendee, 'itinerary');
  const items: unknown[] = Array.isArray(raw) ? raw : [];

  return items.flatMap((item) => {
    if (typeof item !== 'object' || item === null) {
      return [];
    }

    const title = textField(item, ['title', 'name', 'label']);

    if (!title) {
      return [];
    }

    const when = textField(item, ['start', 'at', 'when', 'time']);
    const where = textField(item, ['room', 'where', 'locationName', 'location']);

    return [{ title, ...(when ? { when } : {}), ...(where ? { where } : {}) }];
  });
}

function pdfNextSteps(connections: IConnection[], recapSteps: string[], handshakePeople: number): string[] {
  const fromConnections = connections.flatMap((connection) =>
    connection.note?.nextSteps ? [`@${connection.player.handle}: ${connection.note.nextSteps}`] : [],
  );
  const general = connections.length > 0 && handshakePeople === 0 ? recapSteps.filter((step) => !step.startsWith('Next conference, shake hands')) : recapSteps;

  return [...new Set([...fromConnections, ...general])].slice(0, MAX_NEXT_STEPS);
}

export async function loadRecapPdfData(attendeeId: string): Promise<IRecapPdfData> {
  const attendee = await getAttendee(attendeeId);
  const [recap, connections, talkNotes] = await Promise.all([buildRecap(attendee.id), listConnections(attendee.id), listTalkNotes({ attendeeId: attendee.id })]);
  const notesByTalk = new Map(talkNotes.map((note) => [note.talkId, note]));
  const talks: IRecapPdfTalk[] = recap.talks.map((talk) => {
    const note = notesByTalk.get(talk.talkId);

    return {
      talkId: talk.talkId,
      title: talk.title,
      room: talk.room,
      at: note?.start ?? talk.at,
      speakers: note?.speakers ?? [],
      ...(talk.quizTotal !== undefined ? { quizCorrect: talk.quizCorrect ?? 0, quizTotal: talk.quizTotal } : {}),
      ...(note ? { note } : {}),
    };
  });
  const attended = new Set(talks.map((talk) => talk.talkId));
  const notedOnly: IRecapPdfTalk[] = talkNotes
    .filter((note) => !attended.has(note.talkId))
    .map((note) => ({
      talkId: note.talkId,
      title: note.talkTitle,
      ...(note.room ? { room: note.room } : {}),
      ...(note.start ? { at: note.start } : {}),
      speakers: note.speakers,
      note,
    }));

  return {
    player: recap.player,
    ...(attendee.realName ? { realName: attendee.realName } : {}),
    faceSeed: attendee.faceSeed || attendee.handle,
    totals: { ...recap.totals, people: Math.max(recap.totals.people, connections.length), talks: talks.length + notedOnly.length },
    connections,
    talks: [...talks, ...notedOnly].sort((first, second) => (first.at ?? '').localeCompare(second.at ?? '')),
    booths: recap.booths,
    itinerary: itineraryOf(attendee),
    nextSteps: pdfNextSteps(connections, recap.nextSteps, recap.people.length),
    generatedAt: recap.generatedAt,
  };
}
