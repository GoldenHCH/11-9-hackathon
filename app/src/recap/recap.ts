import { trace } from '@opentelemetry/api';
import { quizLength } from '../ai/quiz';
import { listBoothNotes } from '../booth/booth-notes';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { matchedHandshakes } from '../handshake/handshake.store';
import { getAttendee, getLocations, searchIntros } from '../meet/meet.store';
import { sharedTopicsFor } from '../meet/meets';
import { publicPlayer } from '../profile/public-id';
import { IStoredHandshake } from '../types/internal.interfaces';
import { IAttendee, IIntro, IPublicPlayer, IRecap, IRecapBooth, IRecapPerson, IRecapTalk, ITalk, IXpEvent } from '../types/kubequest.interfaces';
import { levelDefinitionForXp } from '../xp/levels';
import { boothNextStep, overallNextSteps, personNextStep } from './next-steps.helper';
import { recapSubject, renderRecapEmail } from './recap-email';
import { RecapContent } from './recap.types';

const EVENT_PAGE = 500;

async function xpEvents(attendeeId: string, type: 'check_in' | 'quiz'): Promise<IXpEvent[]> {
  const response = await getEsClient().search<IXpEvent>(
    {
      index: indexNames.XP_EVENTS,
      size: EVENT_PAGE,
      query: { bool: { filter: [{ term: { attendeeId } }, { term: { type } }, { exists: { field: 'talkId' } }] } },
      sort: [{ at: { order: 'asc' } }],
    },
    { ...esOptions(esTimeouts.SEARCH_MS), ignore: [404] },
  );

  return (response.hits?.hits ?? []).flatMap((hit) => (hit._source ? [hit._source] : []));
}

async function loadTalks(ids: string[]): Promise<Map<string, ITalk>> {
  const found = new Map<string, ITalk>();

  if (ids.length === 0) {
    return found;
  }

  const response = await getEsClient().mget<ITalk>(
    { index: indexNames.TALKS, ids, _source_excludes: ['transcript', 'searchText', 'quiz', 'bossQuiz'] },
    esOptions(esTimeouts.DEFAULT_MS),
  );

  for (const doc of response.docs) {
    if ('found' in doc && doc.found && doc._source) {
      found.set(doc._id, { ...doc._source, id: doc._id });
    }
  }

  return found;
}

async function recapTalks(attendeeId: string): Promise<IRecapTalk[]> {
  const [checkIns, quizzes] = await Promise.all([xpEvents(attendeeId, 'check_in'), xpEvents(attendeeId, 'quiz')]);
  const firstCheckIn = new Map<string, IXpEvent>();

  for (const event of checkIns) {
    if (event.talkId && !firstCheckIn.has(event.talkId)) {
      firstCheckIn.set(event.talkId, event);
    }
  }

  const bestQuiz = new Map<string, number>();

  for (const event of quizzes) {
    if (event.talkId && event.correct !== undefined) {
      bestQuiz.set(event.talkId, Math.max(bestQuiz.get(event.talkId) ?? 0, event.correct));
    }
  }

  const talks = await loadTalks([...firstCheckIn.keys()]);

  return [...firstCheckIn.entries()].flatMap(([talkId, event]) => {
    const talk = talks.get(talkId);

    if (!talk) {
      return [];
    }

    const correct = bestQuiz.get(talkId);

    return [
      {
        talkId,
        title: talk.title,
        room: talk.room,
        at: event.at,
        ...(correct !== undefined ? { quizCorrect: correct, quizTotal: quizLength(talk) } : {}),
      },
    ];
  });
}

function mutuallyAccepted(intros: IIntro[], partnerId: string): boolean {
  return intros.some(
    (intro) =>
      (intro.fromId === partnerId || intro.toId === partnerId) &&
      (intro.status === 'accepted' || intro.status === 'met'),
  );
}

function questionFor(handshake: IStoredHandshake, viewerId: string, partner: IAttendee): { question: string; theirAnswer?: string } {
  const lastAttempt = handshake.askerAttempts[handshake.askerAttempts.length - 1];

  if (handshake.askerId === viewerId) {
    return { question: handshake.question, ...(handshake.answererAnswer ? { theirAnswer: handshake.answererAnswer } : {}) };
  }

  return { question: `@${partner.handle} asked you: ${handshake.answererQuestion}`, ...(lastAttempt ? { theirAnswer: lastAttempt } : {}) };
}

async function recapPeople(attendee: IAttendee): Promise<IRecapPerson[]> {
  const [handshakes, intros] = await Promise.all([matchedHandshakes(attendee.id), searchIntros(attendee.id)]);
  const latestByPartner = new Map<string, IStoredHandshake>();

  for (const handshake of handshakes) {
    latestByPartner.set(handshake.askerId === attendee.id ? handshake.answererId : handshake.askerId, handshake);
  }

  const people = await Promise.all(
    [...latestByPartner.entries()].map(async ([partnerId, handshake]) => {
      const partner = await getAttendee(partnerId).catch(() => undefined);

      if (!partner) {
        return undefined;
      }

      const shown = publicPlayer({ id: partner.id, handle: partner.handle, faceSeed: partner.faceSeed });
      const sharedTopics = sharedTopicsFor(attendee, partner);
      const githubLogin = mutuallyAccepted(intros.map((stored) => stored.intro), partner.id) ? partner.githubLogin : undefined;
      const asked = questionFor(handshake, attendee.id, partner);
      const person: IRecapPerson = {
        playerId: shown.id,
        handle: partner.handle,
        faceSeed: shown.faceSeed,
        metAt: handshake.matchedAt ?? handshake.createdAt,
        ...asked,
        sharedTopics,
        ...(githubLogin ? { githubLogin } : {}),
        nextStep: personNextStep(partner.handle, sharedTopics, githubLogin, asked.theirAnswer),
      };

      return person;
    }),
  );

  return people.filter((person): person is IRecapPerson => person !== undefined);
}

async function recapBooths(attendeeId: string): Promise<IRecapBooth[]> {
  const notes = await listBoothNotes(attendeeId);
  const locations = await getLocations(notes.map((note) => note.locationId));

  return notes.map((note) => ({
    locationId: note.locationId,
    name: note.boothName,
    ...(note.boothNumber ? { boothNumber: note.boothNumber } : {}),
    liked: note.liked,
    ...(note.thoughts ? { thoughts: note.thoughts } : {}),
    followUp: note.followUp,
    nextStep: boothNextStep(note.boothName, note.followUp, note.liked, locations.get(note.locationId)?.askAbout),
  }));
}

function playerFor(attendee: IAttendee): IPublicPlayer {
  return publicPlayer({
    id: attendee.id,
    handle: attendee.handle,
    faceSeed: attendee.faceSeed,
    level: attendee.level,
    levelName: levelDefinitionForXp(attendee.xp).name,
    xp: attendee.xp,
    banners: attendee.banners,
    ...(attendee.isSpeaker ? { isSpeaker: true } : {}),
  });
}

export function finishRecap(content: RecapContent): IRecap {
  return { ...content, emailSubject: recapSubject(content), emailHtml: renderRecapEmail(content) };
}

export async function buildRecap(attendeeId: string): Promise<IRecap> {
  const attendee = await getAttendee(attendeeId);
  const [talks, people, booths] = await Promise.all([recapTalks(attendee.id), recapPeople(attendee), recapBooths(attendee.id)]);
  const content: RecapContent = {
    player: playerFor(attendee),
    generatedAt: new Date().toISOString(),
    totals: {
      xp: attendee.xp,
      talks: talks.length,
      people: people.length,
      booths: booths.length,
      quizCorrect: talks.reduce((sum, talk) => sum + (talk.quizCorrect ?? 0), 0),
    },
    talks,
    people,
    booths,
    nextSteps: overallNextSteps(talks, people, booths),
  };

  trace.getActiveSpan()?.setAttributes({
    'kubequest.recap.talks': talks.length,
    'kubequest.recap.people': people.length,
    'kubequest.recap.booths': booths.length,
  });

  return finishRecap(content);
}
