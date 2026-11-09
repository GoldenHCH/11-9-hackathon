import { HttpErrorResponse } from '@angular/common/http';
import {
  ExhibitorType,
  IExhibitorCard,
  IExhibitorDetail,
  IExhibitorDirectory,
  IFacetCount,
  IMapPoint,
} from '../core/interfaces/exhibitor.interfaces';
import { venueAreaKindDisplay } from '../map/venue.constants';
import { IVenueLevel } from '../map/venue.interfaces';
import { exhibitorPageSettings, exhibitorTierOrder, exhibitorTypeLabels, topicLabels } from './exhibitors.constants';
import { IExhibitorFilters, IFacetGroup, IFacetOption, IMiniMap } from './exhibitors.interfaces';

export class ExhibitorsHelper {
  private static readonly _talkTimeFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: exhibitorPageSettings.CONFERENCE_TIME_ZONE,
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });

  private static readonly _clockFormat = new Intl.DateTimeFormat('en-US', {
    timeZone: exhibitorPageSettings.CONFERENCE_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  });

  public static topicLabel(topic: string): string {
    return topicLabels[topic] ?? topic;
  }

  public static boothLabel(exhibitor: Pick<IExhibitorCard, 'exhibitorType' | 'boothNumber'>): string {
    if (!exhibitor.boothNumber) {
      return 'No booth on the floor';
    }

    return exhibitor.exhibitorType === 'project' ? `Kiosk ${exhibitor.boothNumber}` : `Booth ${exhibitor.boothNumber}`;
  }

  public static hallLabel(hall: string | undefined): string {
    if (!hall) {
      return '';
    }

    return /^hall/i.test(hall) ? hall : `Hall ${hall}`;
  }

  public static whereLine(exhibitor: Pick<IExhibitorCard, 'hall' | 'zone'>): string {
    return [ExhibitorsHelper.hallLabel(exhibitor.hall), exhibitor.zone ? `${exhibitor.zone} zone` : '']
      .filter((part) => part.length > 0)
      .join(' · ');
  }

  public static mapAriaLabel(exhibitor: IExhibitorDetail): string {
    const hall = ExhibitorsHelper.hallLabel(exhibitor.hall);
    const inHall = hall ? ` in ${hall}` : ' on the expo floor';
    const zone = exhibitor.zone ? `, ${exhibitor.zone} zone` : '';

    return `${ExhibitorsHelper.boothLabel(exhibitor)}${inHall}${zone}`;
  }

  public static formatTalkTime(isoDate: string): string {
    const date = new Date(isoDate);

    return Number.isNaN(date.getTime()) ? '' : ExhibitorsHelper._talkTimeFormat.format(date);
  }

  public static formatClock(isoDate: string | undefined): string {
    if (!isoDate) {
      return '';
    }

    const date = new Date(isoDate);

    return Number.isNaN(date.getTime()) ? '' : ExhibitorsHelper._clockFormat.format(date);
  }

  public static facetGroups(facets: IExhibitorDirectory['facets'] | null, filters: IExhibitorFilters): IFacetGroup[] {
    if (!facets) {
      return [];
    }

    const groups: IFacetGroup[] = [
      {
        key: 'type',
        label: 'Type',
        options: ExhibitorsHelper._options(facets.types, filters.type, (value) => exhibitorTypeLabels[value] ?? value),
      },
      {
        key: 'tier',
        label: 'Tier',
        options: ExhibitorsHelper._options(facets.tiers, filters.tier, (value) => value).sort(
          (first, second) => ExhibitorsHelper._tierRank(first.value) - ExhibitorsHelper._tierRank(second.value),
        ),
      },
      {
        key: 'zone',
        label: 'Zone',
        options: ExhibitorsHelper._options(facets.zones, filters.zone, (value) => value).sort((first, second) =>
          first.label.localeCompare(second.label),
        ),
      },
      {
        key: 'topic',
        label: 'Topic',
        options: ExhibitorsHelper._options(facets.topics, filters.topic, (value) => ExhibitorsHelper.topicLabel(value)),
      },
    ];

    return groups.filter((group) => group.options.length > 0);
  }

  public static isExhibitorType(value: string): value is ExhibitorType {
    return value === 'sponsor' || value === 'project';
  }

  public static hasFilters(filters: IExhibitorFilters): boolean {
    return Boolean(filters.type || filters.tier || filters.zone || filters.topic);
  }

  public static errorCode(error: unknown): string | null {
    if (!(error instanceof HttpErrorResponse)) {
      return null;
    }

    const body: unknown = error.error;

    if (typeof body !== 'object' || body === null) {
      return null;
    }

    const inner: unknown = Reflect.get(body, 'error');

    if (typeof inner !== 'object' || inner === null) {
      return null;
    }

    const code: unknown = Reflect.get(inner, 'code');

    return typeof code === 'string' ? code : null;
  }

  public static buildMiniMap(level: IVenueLevel, position: IMapPoint, zone: string | undefined): IMiniMap {
    const padding = exhibitorPageSettings.MAP_PADDING;
    const areas = level.areas.filter((area) => area.kind !== 'theater' && area.kind !== 'campfire');
    const bounds = areas.reduce(
      (box, area) => ({
        minX: Math.min(box.minX, area.shape.x),
        minY: Math.min(box.minY, area.shape.y),
        maxX: Math.max(box.maxX, area.shape.x + area.shape.width),
        maxY: Math.max(box.maxY, area.shape.y + area.shape.height),
      }),
      { minX: position.x, minY: position.y, maxX: position.x, maxY: position.y },
    );
    const homeArea = areas.find(
      (area) =>
        position.x >= area.shape.x &&
        position.x <= area.shape.x + area.shape.width &&
        position.y >= area.shape.y &&
        position.y <= area.shape.y + area.shape.height &&
        (!zone || !area.zone || area.zone === zone),
    );

    return {
      viewBox: [
        bounds.minX - padding,
        bounds.minY - padding,
        bounds.maxX - bounds.minX + padding * 2,
        bounds.maxY - bounds.minY + padding * 2,
      ].join(' '),
      areas: [...areas]
        .sort((first, second) => second.shape.width * second.shape.height - first.shape.width * first.shape.height)
        .map((area) => ({
          id: area.id,
          label: area.shortLabel ?? area.name,
          x: area.shape.x,
          y: area.shape.y,
          width: area.shape.width,
          height: area.shape.height,
          fill: venueAreaKindDisplay[area.kind].fill,
          showLabel: area.shape.width >= exhibitorPageSettings.MIN_LABEL_WIDTH,
          isHome: area.id === homeArea?.id,
        })),
      markerX: position.x,
      markerY: position.y,
      markerSize: exhibitorPageSettings.MARKER_SIZE,
    };
  }

  private static _options(
    counts: IFacetCount[] | undefined,
    selected: string | undefined,
    labelFor: (value: string) => string,
  ): IFacetOption[] {
    const options = (counts ?? []).map((facet) => ({ ...facet, label: labelFor(facet.value) }));

    if (selected && !options.some((option) => option.value === selected)) {
      options.unshift({ value: selected, count: 0, label: labelFor(selected) });
    }

    return options;
  }

  private static _tierRank(tier: string): number {
    const rank = exhibitorTierOrder.findIndex((candidate) => candidate === tier);

    return rank === -1 ? exhibitorTierOrder.length : rank;
  }
}
