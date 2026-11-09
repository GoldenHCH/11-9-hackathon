import { createHmac } from 'node:crypto';
import { readQrSecret } from '../config';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { ToolError } from '../tools/tool-errors';
import {
  ICheckInResult,
  ILeaderboard,
  ILeaderboardRow,
  IHandshake,
  IHandshakeStateResult,
  IMeet,
  IPersonMatch,
  IPublicPlayer,
  IQuest,
  IQuestBoard,
  ISearchResponse,
  IWhatsAroundMe,
} from '../types/kubequest.interfaces';

const publicIdPrefix = 'pl_';
const publicIdLength = 16;
const rescanIntervalMs = 5000;
const scanSize = 10000;
const knownIds = new Map<string, string>();
let lastScanAt = 0;

function publicIdSecret(): string {
  return process.env['PUBLIC_ID_SECRET']?.trim() || readQrSecret() || 'kubequest-public-id';
}

export function isPublicId(id: string): boolean {
  return id.startsWith(publicIdPrefix);
}

export function publicIdFor(attendeeId: string): string {
  const digest = createHmac('sha256', publicIdSecret()).update(`public-id:${attendeeId}`).digest('hex');
  const publicId = `${publicIdPrefix}${digest.slice(0, publicIdLength)}`;
  knownIds.set(publicId, attendeeId);

  return publicId;
}

async function scanAttendeeIds(): Promise<void> {
  const response = await getEsClient().search(
    { index: indexNames.ATTENDEES, size: scanSize, _source: false, query: { match_all: {} } },
    esOptions(esTimeouts.SEARCH_MS),
  );

  for (const hit of response.hits.hits) {
    if (hit._id) {
      publicIdFor(hit._id);
    }
  }
}

export async function resolvePlayerId(id: string): Promise<string> {
  if (!isPublicId(id)) {
    return id;
  }

  const cached = knownIds.get(id);

  if (cached) {
    return cached;
  }

  if (Date.now() - lastScanAt > rescanIntervalMs) {
    lastScanAt = Date.now();
    await scanAttendeeIds();
  }

  const resolved = knownIds.get(id);

  if (!resolved) {
    throw new ToolError(404, 'unknown_player', 'That player is not visible right now.');
  }

  return resolved;
}

export function publicPlayer<T extends Pick<IPublicPlayer, 'id' | 'handle' | 'faceSeed'>>(player: T): T {
  if (isPublicId(player.id)) {
    return player;
  }

  const faceSeed = player.faceSeed && player.faceSeed !== player.id ? player.faceSeed : player.handle;

  return { ...player, id: publicIdFor(player.id), faceSeed };
}

export function publicQuest(quest: IQuest): IQuest {
  return quest.partnerId && !isPublicId(quest.partnerId) ? { ...quest, partnerId: publicIdFor(quest.partnerId) } : quest;
}

export function publicQuestBoard(board: IQuestBoard): IQuestBoard {
  return {
    ...board,
    offers: board.offers.map(publicQuest),
    active: board.active.map(publicQuest),
    doneToday: board.doneToday.map(publicQuest),
  };
}

export function publicMeet(meet: IMeet): IMeet {
  return { ...meet, partner: publicPlayer(meet.partner) };
}

export function publicPersonMatch(match: IPersonMatch): IPersonMatch {
  return { ...match, player: publicPlayer(match.player) };
}

function publicRow(row: ILeaderboardRow): ILeaderboardRow {
  return { ...row, player: publicPlayer(row.player) };
}

export function publicLeaderboard(board: ILeaderboard): ILeaderboard {
  return { ...board, rows: board.rows.map(publicRow), ...(board.me ? { me: publicRow(board.me) } : {}) };
}

export function publicSearch(response: ISearchResponse): ISearchResponse {
  return {
    ...response,
    results: response.results.map((result) => {
      if (!result.player) {
        return result;
      }

      const player = publicPlayer(result.player);

      return { ...result, id: result.kind === 'player' ? player.id : result.id, player };
    }),
  };
}

export function publicCheckIn(result: ICheckInResult): ICheckInResult {
  return {
    ...result,
    completedQuests: result.completedQuests.map(publicQuest),
    ...(result.meet ? { meet: publicMeet(result.meet) } : {}),
  };
}

export function publicAround<T extends IWhatsAroundMe>(around: T): T {
  return around.matchesHere ? { ...around, matchesHere: around.matchesHere.map(publicPersonMatch) } : around;
}

export function publicHandshake(handshake: IHandshake): IHandshake {
  return { ...handshake, partner: publicPlayer(handshake.partner) };
}

export function publicHandshakeState(state: IHandshakeStateResult): IHandshakeStateResult {
  return state.handshake ? { handshake: publicHandshake(state.handshake) } : state;
}
