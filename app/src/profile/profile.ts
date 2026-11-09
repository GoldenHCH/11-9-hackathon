import { appConfig } from '../config';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { inventoryTool } from '../tools/inventory.tool';
import { respondMeetTool } from '../tools/respond-meet.tool';
import { isToolError, ToolError } from '../tools/tool-errors';
import { materials } from '../types/kubequest.constants';
import { IAttendee, IInventory, IProfile } from '../types/kubequest.interfaces';
import { MaterialCounts } from '../types/kubequest.types';
import { levelProgress } from '../xp/levels';
import { getAttendee } from './attendees';
import { confirmedMeetStatuses, defaultSettings, openMeetStatuses, signupLimits } from './profile.constants';
import { publicIdFor } from './public-id';

export function personalLinkFor(attendeeId: string): string {
  return `${appConfig.publicBaseUrl.replace(/\/$/, '')}/me/${encodeURIComponent(attendeeId)}`;
}

function emptyInventory(): IInventory {
  const blocks = Object.fromEntries(materials.map((material) => [material, 0])) as MaterialCounts;

  return { blocks, totalBlocks: 0, gems: 0, banners: [] };
}

async function safeInventory(attendeeId: string): Promise<IInventory> {
  try {
    return await inventoryTool.run({ attendeeId });
  } catch (error) {
    if (!isToolError(error) || error.status !== 501) {
      logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'inventory unavailable for profile');
    }

    return emptyInventory();
  }
}

export async function buildOwnProfile(attendee: IAttendee): Promise<IProfile> {
  return {
    attendee,
    level: levelProgress(attendee.xp),
    inventory: await safeInventory(attendee.id),
    personalLink: personalLinkFor(attendee.id),
    publicId: publicIdFor(attendee.id),
  };
}

export async function isConfirmedPartner(viewerId: string, targetId: string): Promise<boolean> {
  try {
    const response = await getEsClient().count(
      {
        index: indexNames.INTROS,
        query: {
          bool: {
            filter: [{ terms: { status: [...confirmedMeetStatuses] } }],
            should: [
              { bool: { filter: [{ term: { fromId: viewerId } }, { term: { toId: targetId } }] } },
              { bool: { filter: [{ term: { fromId: targetId } }, { term: { toId: viewerId } }] } },
            ],
            minimum_should_match: 1,
          },
        },
      },
      esOptions(esTimeouts.DEFAULT_MS),
    );

    return response.count > 0;
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'partner check failed, treating as public');

    return false;
  }
}

export function redactAttendee(attendee: IAttendee, partner: boolean): IAttendee {
  return {
    id: publicIdFor(attendee.id),
    handle: attendee.handle,
    faceSeed: attendee.faceSeed,
    realName: partner ? attendee.realName : undefined,
    photoUrl: partner ? attendee.photoUrl ?? attendee.avatarUrl : undefined,
    spotMe: partner ? attendee.spotMe : undefined,
    workingOn: partner ? attendee.workingOn : '',
    profileText: '',
    profile: {
      topics: partner ? attendee.profile.topics : [],
      firstTimer: partner ? attendee.profile.firstTimer : false,
      welcomer: partner ? attendee.profile.welcomer : false,
    },
    settings: { ...defaultSettings, meetingOn: false },
    isSpeaker: attendee.isSpeaker,
    visible: attendee.visible,
    xp: attendee.xp,
    level: attendee.level,
    banners: attendee.banners,
    blockedIds: [],
    createdAt: attendee.createdAt,
  };
}

export async function viewProfile(viewerId: string, targetId: string): Promise<IProfile> {
  const target = await getAttendee(targetId);

  if (!target.visible || target.blockedIds.includes(viewerId)) {
    throw new ToolError(404, 'unknown_attendee', 'That player is not visible right now.');
  }

  const partner = await isConfirmedPartner(viewerId, targetId);

  return {
    attendee: redactAttendee(target, partner),
    level: levelProgress(target.xp),
    inventory: await safeInventory(target.id),
    personalLink: '',
    publicId: publicIdFor(target.id),
  };
}

interface IOpenIntro {
  id: string;
  status: string;
}

async function openIntros(attendeeId: string): Promise<IOpenIntro[]> {
  const response = await getEsClient().search<IOpenIntro>(
    {
      index: indexNames.INTROS,
      size: signupLimits.OPEN_MEET_SCAN,
      _source: ['id', 'status'],
      query: {
        bool: {
          filter: [{ terms: { status: [...openMeetStatuses] } }],
          should: [{ term: { fromId: attendeeId } }, { term: { toId: attendeeId } }],
          minimum_should_match: 1,
        },
      },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  return response.hits.hits.map((hit) => ({ id: hit._id ?? hit._source?.id ?? '', status: hit._source?.status ?? 'proposed' })).filter((intro) => intro.id !== '');
}

async function cancelDirectly(attendeeId: string, intros: IOpenIntro[]): Promise<void> {
  const now = new Date().toISOString();
  const operations = intros.flatMap((intro) => [
    { update: { _index: indexNames.INTROS, _id: intro.id } },
    { doc: { status: 'cancelled', cancelledBy: attendeeId, respondedAt: now } },
  ]);

  await getEsClient().bulk({ operations, refresh: 'wait_for' }, esOptions(esTimeouts.WRITE_MS));
}

export async function withdrawOpenMeets(attendeeId: string): Promise<number> {
  let intros: IOpenIntro[];

  try {
    intros = await openIntros(attendeeId);
  } catch (error) {
    logger.warn({ err: error instanceof Error ? error.message : String(error) }, 'could not list open meets to withdraw');

    return 0;
  }

  const leftovers: IOpenIntro[] = [];

  for (const intro of intros) {
    try {
      await respondMeetTool.run({ attendeeId, meetId: intro.id, response: intro.status === 'accepted' ? 'cant_make_it' : 'decline' });
    } catch {
      leftovers.push(intro);
    }
  }

  if (leftovers.length > 0) {
    await cancelDirectly(attendeeId, leftovers);
  }

  return intros.length;
}
