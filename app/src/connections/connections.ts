import { trace } from '@opentelemetry/api';
import { matchedHandshakes } from '../handshake/handshake.store';
import { linkItems } from '../links/links.helper';
import { logger } from '../observability/logger';
import { getAttendee, getIntro, getLocations, searchIntros } from '../meet/meet.store';
import { publicIdFor, publicPlayer } from '../profile/public-id';
import { ToolError } from '../tools/tool-errors';
import { IStoredHandshake } from '../types/internal.interfaces';
import {
  IConnection,
  IConnectionNote,
  IConnectionPlace,
  ISaveConnectionNoteInput,
  IStoredConnection,
  IStoredConnectionDetail,
} from '../types/connections.interfaces';
import { docKinds } from '../types/connections.constants';
import { IAttendee, IIntro } from '../types/kubequest.interfaces';
import { levelDefinitionForXp } from '../xp/levels';
import {
  connectionIdFor,
  createConnection,
  getConnection,
  getConnectionNotes,
  replaceConnection,
  searchConnections,
  writeConnectionNote,
} from './connection.store';

interface IConnectionCandidate {
  firstId: string;
  secondId: string;
  metAt: string;
  detail: IStoredConnectionDetail;
}

async function placeFor(locationId: string | undefined): Promise<IConnectionPlace | undefined> {
  if (!locationId) {
    return undefined;
  }

  const location = (await getLocations([locationId])).get(locationId);

  return location ? { id: location.id ?? locationId, name: location.name } : undefined;
}

async function lastPlaceOf(attendeeId: string): Promise<IConnectionPlace | undefined> {
  const attendee = await getAttendee(attendeeId).catch(() => undefined);

  return placeFor(attendee?.lastLocationId);
}

async function candidateFromIntro(intro: IIntro): Promise<IConnectionCandidate> {
  const place = await placeFor(intro.campfireId);

  return {
    firstId: intro.fromId,
    secondId: intro.toId,
    metAt: intro.metAt ?? intro.respondedAt ?? intro.proposedAt,
    detail: {
      publicIds: [publicIdFor(intro.fromId), publicIdFor(intro.toId)],
      source: 'meet',
      meetId: intro.id,
      ...(place ? { place } : {}),
      ...(intro.chatPrompt ? { chatPrompt: intro.chatPrompt } : {}),
      ...(intro.icebreaker ? { icebreaker: intro.icebreaker } : {}),
      sharedTopics: intro.sharedTopics ?? [],
    },
  };
}

async function candidateFromHandshake(handshake: IStoredHandshake): Promise<IConnectionCandidate> {
  const intro = handshake.meetId ? (await getIntro(handshake.meetId).catch(() => undefined))?.intro : undefined;
  const base: IConnectionCandidate = {
    firstId: handshake.askerId,
    secondId: handshake.answererId,
    metAt: handshake.matchedAt ?? handshake.createdAt,
    detail: {
      publicIds: [publicIdFor(handshake.askerId), publicIdFor(handshake.answererId)],
      source: 'handshake',
      handshakeId: handshake.id,
      sharedTopics: handshake.sharedTopics ?? [],
    },
  };

  if (intro) {
    const fromMeet = await candidateFromIntro(intro);

    return { ...base, detail: { ...fromMeet.detail, handshakeId: handshake.id, sharedTopics: [...new Set([...fromMeet.detail.sharedTopics, ...base.detail.sharedTopics])] } };
  }

  const place = await lastPlaceOf(handshake.askerId);

  return place ? { ...base, detail: { ...base.detail, place } } : base;
}

function mergeDetail(existing: IStoredConnectionDetail, incoming: IStoredConnectionDetail): IStoredConnectionDetail {
  return {
    publicIds: existing.publicIds,
    source: existing.meetId || incoming.meetId ? 'meet' : existing.source,
    ...(existing.meetId ?? incoming.meetId ? { meetId: existing.meetId ?? incoming.meetId } : {}),
    ...(existing.handshakeId ?? incoming.handshakeId ? { handshakeId: existing.handshakeId ?? incoming.handshakeId } : {}),
    ...(existing.place ?? incoming.place ? { place: existing.place ?? incoming.place } : {}),
    ...(existing.chatPrompt ?? incoming.chatPrompt ? { chatPrompt: existing.chatPrompt ?? incoming.chatPrompt } : {}),
    ...(existing.icebreaker ?? incoming.icebreaker ? { icebreaker: existing.icebreaker ?? incoming.icebreaker } : {}),
    sharedTopics: [...new Set([...existing.sharedTopics, ...incoming.sharedTopics])],
  };
}

async function upsertConnection(candidate: IConnectionCandidate): Promise<IStoredConnection> {
  const id = connectionIdFor(candidate.firstId, candidate.secondId);
  const now = new Date().toISOString();

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const stored = await getConnection(id);

    if (!stored) {
      const connection: IStoredConnection = {
        id,
        kind: docKinds.CONNECTION,
        memberIds: [candidate.firstId, candidate.secondId].sort(),
        metAt: candidate.metAt,
        createdAt: now,
        updatedAt: now,
        detail: candidate.detail,
      };

      if (await createConnection(connection)) {
        return connection;
      }

      continue;
    }

    const detail = mergeDetail(stored.connection.detail, candidate.detail);
    const metAt = stored.connection.metAt < candidate.metAt ? stored.connection.metAt : candidate.metAt;

    if (JSON.stringify(detail) === JSON.stringify(stored.connection.detail) && metAt === stored.connection.metAt) {
      return stored.connection;
    }

    const next: IStoredConnection = { ...stored.connection, detail, metAt, updatedAt: now };

    try {
      await replaceConnection(stored, next);

      return next;
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
    }
  }

  throw new ToolError(409, 'conflict', 'That connection changed while we saved it. Try again.');
}

export async function recordConnectionFromHandshake(handshake: IStoredHandshake): Promise<void> {
  try {
    await upsertConnection(await candidateFromHandshake(handshake));
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : String(error), handshakeId: handshake.id }, 'could not record the connection');
  }
}

export async function recordConnectionFromMeet(intro: IIntro): Promise<IStoredConnection> {
  return upsertConnection(await candidateFromIntro(intro));
}

function pairOf(candidate: IConnectionCandidate): string {
  return connectionIdFor(candidate.firstId, candidate.secondId);
}

export async function syncConnections(attendeeId: string): Promise<void> {
  const [handshakes, intros, existing] = await Promise.all([matchedHandshakes(attendeeId), searchIntros(attendeeId), searchConnections(attendeeId)]);
  const known = new Set(existing.map((connection) => connection.id));
  const candidates = await Promise.all([
    ...intros.filter((stored) => stored.intro.status === 'met').map((stored) => candidateFromIntro(stored.intro)),
    ...handshakes.map((handshake) => candidateFromHandshake(handshake)),
  ]);
  const missing = candidates.filter((candidate) => !known.has(pairOf(candidate)));

  for (const candidate of missing) {
    await upsertConnection(candidate);
  }
}

export async function areConnected(firstId: string, secondId: string): Promise<boolean> {
  if (firstId === secondId) {
    return true;
  }

  if (await getConnection(connectionIdFor(firstId, secondId))) {
    return true;
  }

  await syncConnections(firstId);

  return (await getConnection(connectionIdFor(firstId, secondId))) !== undefined;
}

function isBlocked(viewer: IAttendee, other: IAttendee): boolean {
  return viewer.blockedIds.includes(other.id) || other.blockedIds.includes(viewer.id);
}

function viewConnection(connection: IStoredConnection, other: IAttendee, note: IConnectionNote | undefined): IConnection {
  const shown = publicPlayer({ id: other.id, handle: other.handle, faceSeed: other.faceSeed });

  return {
    id: connection.id,
    player: {
      id: shown.id,
      handle: other.handle,
      faceSeed: shown.faceSeed,
      level: other.level,
      levelName: levelDefinitionForXp(other.xp).name,
      xp: other.xp,
      banners: other.banners,
      ...(other.realName ? { realName: other.realName } : {}),
      ...(other.headline ? { headline: other.headline } : {}),
      workingOn: other.workingOn,
      topics: other.profile.topics,
    },
    links: linkItems(other.links, other.githubVerified),
    source: connection.detail.source,
    ...(connection.detail.place ? { where: connection.detail.place } : {}),
    metAt: connection.metAt,
    ...(connection.detail.chatPrompt ? { chatPrompt: connection.detail.chatPrompt } : {}),
    sharedTopics: connection.detail.sharedTopics,
    ...(note ? { note } : {}),
  };
}

async function viewConnections(viewer: IAttendee, connections: IStoredConnection[]): Promise<IConnection[]> {
  const notes = await getConnectionNotes(
    viewer.id,
    connections.map((connection) => connection.id),
  );
  const views = await Promise.all(
    connections.map(async (connection) => {
      const otherId = connection.memberIds.find((memberId) => memberId !== viewer.id);
      const other = otherId ? await getAttendee(otherId).catch(() => undefined) : undefined;

      return other && !isBlocked(viewer, other) ? viewConnection(connection, other, notes.get(connection.id)) : undefined;
    }),
  );

  return views.filter((view): view is IConnection => view !== undefined);
}

export async function listConnections(attendeeId: string): Promise<IConnection[]> {
  const viewer = await getAttendee(attendeeId);
  await syncConnections(viewer.id);
  const connections = await viewConnections(viewer, await searchConnections(viewer.id));
  trace.getActiveSpan()?.setAttribute('kubequest.connection.count', connections.length);

  return connections;
}

export async function saveConnectionNote(input: ISaveConnectionNoteInput): Promise<IConnection> {
  const viewer = await getAttendee(input.attendeeId);
  const stored = await getConnection(input.connectionId);

  if (!stored || !stored.connection.memberIds.includes(viewer.id)) {
    throw new ToolError(404, 'unknown_connection', 'That connection is not yours or no longer exists.');
  }

  const note: IConnectionNote = {
    talkedAbout: input.talkedAbout.trim(),
    nextSteps: input.nextSteps.trim(),
    ...(input.followUpBy ? { followUpBy: input.followUpBy } : {}),
    updatedAt: new Date().toISOString(),
  };
  await writeConnectionNote(viewer.id, stored.connection.id, note);
  trace.getActiveSpan()?.setAttributes({ 'kubequest.connection.id': stored.connection.id, 'kubequest.connection.note_chars': note.talkedAbout.length + note.nextSteps.length });
  const [view] = await viewConnections(viewer, [stored.connection]);

  if (!view) {
    throw new ToolError(404, 'unknown_connection', 'That connection is not available right now.');
  }

  return { ...view, note };
}
