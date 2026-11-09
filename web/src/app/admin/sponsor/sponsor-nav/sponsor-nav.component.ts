import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { sponsorTabs } from '../sponsor.constants';

@Component({
  selector: 'app-sponsor-nav',
  imports: [MatIconModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="sponsor-nav" aria-label="Sponsor pages">
      @for (tab of tabs; track tab.path) {
        <a
          class="sponsor-nav-tab app-pixel"
          [routerLink]="tab.path"
          routerLinkActive="sponsor-nav-tab--active"
          [routerLinkActiveOptions]="{ exact: true }"
          ariaCurrentWhenActive="page"
        >
          <mat-icon aria-hidden="true">{{ tab.icon }}</mat-icon>
          <span>{{ tab.label }}</span>
        </a>
      }
    </nav>
  `,
  styles: `
    .sponsor-nav {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
      border-bottom: 2px solid var(--app-theme--border-soft);
    }

    .sponsor-nav-tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      font-size: 13px;
      color: var(--app-theme--ink-muted);
      text-decoration: none;
      border-bottom: 4px solid transparent;
      margin-bottom: -2px;
    }

    .sponsor-nav-tab:hover {
      color: var(--app-theme--ink);
    }

    .sponsor-nav-tab--active {
      color: var(--app-theme--ink);
      border-bottom-color: var(--app-theme--accent);
    }
  `,
})
export class SponsorNavComponent {
  public readonly tabs = sponsorTabs;
}
