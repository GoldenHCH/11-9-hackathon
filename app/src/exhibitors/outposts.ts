import { appConfig } from '../config';
import { esOptions, getEsClient } from '../es/client';
import { esTimeouts, indexNames } from '../es/es.constants';
import { logger } from '../observability/logger';
import { buildScanUrl, buildStaffUrl, exhibitorAccessKey, signLocationToken } from '../security/tokens';
import { ToolError } from '../tools/tool-errors';
import { exhibitorTierOrder, exhibitorTypes, tracks } from '../types/kubequest.constants';
import { IExhibitorCard, IExhibitorDetail, ILocation } from '../types/kubequest.interfaces';
import { ExhibitorType, Track } from '../types/kubequest.types';
import { defaultTiers, exhibitorMessages, exhibitorSettings } from './exhibitors.constants';

interface IOutpostCache {
  loadedAt: number;
  list: ILocation[];
  byId: Map<string, ILocation>;
}

let outpostCache: IOutpostCache | undefined;
let pendingLoad: Promise<IOutpostCache> | undefined;

function isTrack(value: string): value is Track {
  return (tracks as readonly string[]).includes(value);
}

function isExhibitorType(value: string | undefined): value is ExhibitorType {
  return value !== undefined && (exhibitorTypes as readonly string[]).includes(value);
}

export function exhibitorTypeOf(location: ILocation): ExhibitorType {
  return isExhibitorType(location.exhibitorType) ? location.exhibitorType : 'sponsor';
}

export function tierOf(location: ILocation): string {
  const tier = location.sponsorTier?.trim();

  if (tier) {
    return tier;
  }

  return exhibitorTypeOf(location) === 'project' ? defaultTiers.PROJECT : defaultTiers.SPONSOR;
}

export function tierRank(tier: string): number {
  const index = (exhibitorTierOrder as readonly string[]).indexOf(tier);

  return index === -1 ? exhibitorTierOrder.length : index;
}

export function compareBooths(left: ILocation, right: ILocation): number {
  const byTier = tierRank(tierOf(left)) - tierRank(tierOf(right));

  if (byTier !== 0) {
    return byTier;
  }

  const byBooth = (left.boothNumber ?? '').localeCompare(right.boothNumber ?? '', 'en', { numeric: true });

  return byBooth !== 0 ? byBooth : left.name.localeCompare(right.name);
}

export function trackTopics(location: ILocation): Track[] {
  return (location.topics ?? []).filter(isTrack);
}

export function toExhibitorCard(location: ILocation, visitorsNow = 0, visitedByMe?: boolean): IExhibitorCard {
  return {
    id: location.id,
    name: location.name,
    exhibitorType: exhibitorTypeOf(location),
    tier: tierOf(location),
    boothNumber: location.boothNumber ?? '',
    ...(location.hall ? { hall: location.hall } : {}),
    ...(location.zone ? { zone: location.zone } : {}),
    topics: trackTopics(location),
    categories: location.categories ?? [],
    ...(location.askAbout ? { askAbout: location.askAbout } : {}),
    visitorsNow,
    ...(visitedByMe !== undefined ? { visitedByMe } : {}),
  };
}

export function toExhibitorDetail(location: ILocation, visitorsNow = 0, visitedByMe?: boolean): IExhibitorDetail {
  return {
    ...toExhibitorCard(location, visitorsNow, visitedByMe),
    building: location.building,
    level: location.level,
    ...(location.description ? { description: location.description } : {}),
    ...(location.schedule ? { schedule: location.schedule } : {}),
    ...(location.mapPosition ? { mapPosition: location.mapPosition } : {}),
  };
}

async function fetchOutposts(): Promise<IOutpostCache> {
  const response = await getEsClient().search<ILocation>(
    {
      index: indexNames.LOCATIONS,
      size: exhibitorSettings.MAX_OUTPOSTS,
      _source: { excludes: ['searchText', '_inference_fields'] },
      query: { bool: { filter: [{ term: { kind: 'outpost' } }] } },
    },
    esOptions(esTimeouts.SEARCH_MS),
  );

  const list = response.hits.hits.flatMap((hit) => (hit._source ? [{ ...hit._source, id: hit._id ?? hit._source.id }] : []));
  list.sort(compareBooths);

  return { loadedAt: Date.now(), list, byId: new Map(list.map((location) => [location.id, location])) };
}

async function outposts(): Promise<IOutpostCache> {
  if (outpostCache && Date.now() - outpostCache.loadedAt < exhibitorSettings.OUTPOST_CACHE_MS) {
    return outpostCache;
  }

  pendingLoad ??= fetchOutposts()
    .then((loaded) => {
      outpostCache = loaded;

      return loaded;
    })
    .catch((error: unknown) => {
      if (outpostCache) {
        logger.warn({ err: error }, 'outpost reload failed, serving the cached list');

        return outpostCache;
      }

      throw error;
    })
    .finally(() => {
      pendingLoad = undefined;
    });

  return pendingLoad;
}

export async function loadOutposts(): Promise<ILocation[]> {
  return (await outposts()).list;
}

export async function findOutpost(outpostId: string): Promise<ILocation | undefined> {
  const cached = (await outposts()).byId.get(outpostId);

  if (cached) {
    return cached;
  }

  const response = await getEsClient().get<ILocation>(
    { index: indexNames.LOCATIONS, id: outpostId, _source_excludes: ['searchText', '_inference_fields'] },
    { ...esOptions(esTimeouts.DEFAULT_MS), ignore: [404] },
  );

  return response.found && response._source?.kind === 'outpost' ? { ...response._source, id: response._id } : undefined;
}

export async function requireOutpost(outpostId: string): Promise<ILocation> {
  const outpost = await findOutpost(outpostId);

  if (!outpost) {
    throw new ToolError(404, 'unknown_outpost', exhibitorMessages.UNKNOWN_OUTPOST);
  }

  return outpost;
}

export function publicPageUrl(outpostId: string): string {
  return new URL(`/exhibitors/${encodeURIComponent(outpostId)}`, appConfig.publicBaseUrl).toString();
}

export function outpostScanUrl(outpostId: string): string {
  return buildScanUrl(outpostId, signLocationToken(outpostId));
}

export function outpostStaffUrl(outpostId: string): string {
  return buildStaffUrl(outpostId, exhibitorAccessKey(outpostId));
}
