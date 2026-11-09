import { IHealthCounts, IHealthElasticsearch, IHealthResponse } from '../core/interfaces/health.interfaces';
import { IHealthCountItem, IHealthViewState, IStatusBadge } from './home.interfaces';

export class HomeHelper {
  public static toReadyState(health: IHealthResponse): IHealthViewState {
    return {
      phase: 'ready',
      health,
      overallBadge: HomeHelper._getOverallBadge(health),
      elasticsearchBadge: HomeHelper._getElasticsearchBadge(health.elasticsearch),
      countItems: HomeHelper._getCountItems(health.elasticsearch.counts),
    };
  }

  private static _getOverallBadge(health: IHealthResponse): IStatusBadge {
    if (health.status === 'ok') {
      return { label: 'All systems go', icon: 'check_circle', tone: 'ok' };
    }

    return { label: 'Degraded', icon: 'warning', tone: 'warn' };
  }

  private static _getElasticsearchBadge(elasticsearch: IHealthElasticsearch): IStatusBadge {
    if (!elasticsearch.configured) {
      return { label: 'Not configured', icon: 'help_outline', tone: 'warn' };
    }

    if (!elasticsearch.reachable) {
      return { label: 'Unreachable', icon: 'cancel', tone: 'error' };
    }

    return { label: 'Reachable', icon: 'check_circle', tone: 'ok' };
  }

  private static _getCountItems(counts: IHealthCounts | undefined): IHealthCountItem[] {
    const countLabels: { key: keyof IHealthCounts; label: string }[] = [
      { key: 'talks', label: 'Talks' },
      { key: 'attendees', label: 'Attendees' },
      { key: 'locations', label: 'Locations' },
      { key: 'xp_events', label: 'XP events' },
      { key: 'intros', label: 'Intros' },
    ];

    return countLabels.map(({ key, label }) => {
      const count = counts?.[key];

      return { key, label, value: count === undefined ? 'n/a' : count.toLocaleString('en-US') };
    });
  }
}
