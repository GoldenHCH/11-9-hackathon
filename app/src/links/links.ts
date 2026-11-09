import { trace } from '@opentelemetry/api';
import { areConnected } from '../connections/connections';
import { getAttendee, patchAttendee } from '../profile/attendees';
import { publicIdFor, resolvePlayerId } from '../profile/public-id';
import { IGetLinksInput, ILinkEnrichment, ILinksView, IProfileLinks, IUpdateLinksInput, IUpdateLinksResult } from '../types/connections.interfaces';
import { IAttendee } from '../types/kubequest.interfaces';
import { blueskySummary, githubSummary, withPublicProfile } from './enrich';
import { blueskyHandleFrom, githubLoginFrom, linkItems, mergeLinks } from './links.helper';

const hiddenReason = 'Links are shared only with people you have met through a meet or a handshake.';

async function enrich(links: IProfileLinks): Promise<ILinkEnrichment[]> {
  const login = links.github ? githubLoginFrom(links.github) : undefined;
  const handle = links.bluesky ? blueskyHandleFrom(links.bluesky) : undefined;

  return Promise.all([...(login ? [githubSummary(login)] : []), ...(handle ? [blueskySummary(handle)] : [])]);
}

function enrichmentChanged(before: IProfileLinks, after: IProfileLinks): boolean {
  return before.github !== after.github || before.bluesky !== after.bluesky;
}

function profilePatch(attendee: IAttendee, links: IProfileLinks, enrichment: ILinkEnrichment[] | undefined): Partial<IAttendee> {
  if (!enrichment) {
    return { links };
  }

  const summaries = enrichment.flatMap((result) => (result.summary ? [result.summary] : []));
  const githubLogin = links.github ? githubLoginFrom(links.github) : undefined;

  return {
    links,
    profileText: withPublicProfile(attendee.profileText ?? '', summaries),
    ...(githubLogin && !attendee.githubLogin ? { githubLogin } : {}),
  };
}

export async function updateLinks(input: IUpdateLinksInput): Promise<IUpdateLinksResult> {
  const attendee = await getAttendee(input.attendeeId);
  const before = attendee.links ?? {};
  const links = mergeLinks(before, input.links);
  const enrichment = enrichmentChanged(before, links) ? await enrich(links) : undefined;
  const githubChanged = attendee.githubVerified === true && before.github !== links.github;
  await patchAttendee(attendee.id, { ...profilePatch(attendee, links, enrichment), ...(githubChanged ? { githubVerified: false } : {}) });
  trace.getActiveSpan()?.setAttributes({
    'kubequest.links.count': Object.keys(links).length,
    'kubequest.links.enriched': (enrichment ?? []).filter((result) => result.status === 'added').length,
  });

  return { links, items: linkItems(links, attendee.githubVerified === true && !githubChanged), enrichment: enrichment ?? [] };
}

export async function getLinks(input: IGetLinksInput): Promise<ILinksView> {
  const [viewer, targetId] = await Promise.all([getAttendee(input.viewerId), resolvePlayerId(input.targetPublicId)]);
  const target = await getAttendee(targetId);
  const isOwner = viewer.id === target.id;
  const blocked = target.blockedIds.includes(viewer.id) || viewer.blockedIds.includes(target.id);
  const isConnection = !isOwner && !blocked && (await areConnected(viewer.id, target.id));
  const visible = isOwner || isConnection;
  const links = visible ? (target.links ?? {}) : {};
  trace.getActiveSpan()?.setAttributes({ 'kubequest.links.visible': visible, 'kubequest.links.is_owner': isOwner });

  return {
    publicId: publicIdFor(target.id),
    handle: target.handle,
    isOwner,
    isConnection,
    visible,
    links,
    items: linkItems(links, visible && target.githubVerified === true),
    githubVerified: visible && target.githubVerified === true && links.github !== undefined,
    ...(visible ? {} : { hiddenReason }),
  };
}
