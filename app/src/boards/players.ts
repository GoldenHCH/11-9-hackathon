import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { IAttendee, IPublicPlayer } from '../types/kubequest.interfaces';
import { levelDefinitionForXp } from '../xp/levels';
import { boardLimits } from './boards.constants';

type BoardAttendee = Pick<IAttendee, 'id' | 'handle' | 'faceSeed' | 'xp' | 'banners' | 'isSpeaker' | 'settings'>;

const boardAttendeeFields = ['id', 'handle', 'faceSeed', 'xp', 'banners', 'isSpeaker', 'settings.hideFromLeaderboard'];

export async function hiddenPlayerIds(): Promise<string[]> {
  const response = await getEsClient().search<Pick<IAttendee, 'id'>>(
    {
      index: indexNames.ATTENDEES,
      size: boardLimits.HIDDEN_PLAYERS,
      _source: ['id'],
      query: { term: { 'settings.hideFromLeaderboard': true } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.hits.hits.flatMap((hit) => (hit._source?.id ? [hit._source.id] : []));
}

export function toPublicPlayer(attendee: BoardAttendee): IPublicPlayer {
  const xp = attendee.xp ?? 0;
  const level = levelDefinitionForXp(xp);

  return {
    id: attendee.id,
    handle: attendee.handle,
    faceSeed: attendee.faceSeed || attendee.handle,
    level: level.level,
    levelName: level.name,
    xp,
    banners: attendee.banners ?? [],
    ...(attendee.isSpeaker ? { isSpeaker: true } : {}),
  };
}

export async function loadVisiblePlayers(ids: string[]): Promise<Map<string, IPublicPlayer>> {
  const players = new Map<string, IPublicPlayer>();

  if (ids.length === 0) {
    return players;
  }

  const response = await getEsClient().search<BoardAttendee>(
    {
      index: indexNames.ATTENDEES,
      size: ids.length,
      _source: boardAttendeeFields,
      query: { terms: { id: ids } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  for (const hit of response.hits.hits) {
    const attendee = hit._source;

    if (attendee?.id && !attendee.settings?.hideFromLeaderboard) {
      players.set(attendee.id, toPublicPlayer(attendee));
    }
  }

  return players;
}
