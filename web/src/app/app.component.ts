import { AsyncPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { filter, map, shareReplay, startWith } from 'rxjs';
import { fullScreenRoutePrefixes, navigationTabs, roleViews } from './app.constants';
import { AppHelper } from './app.helper';
import { LoadingService } from './core/services/loading.service';
import { MessagesBadgeComponent } from './messages/messages-badge/messages-badge.component';
import { NotificationBellComponent } from './notifications/notification-bell/notification-bell.component';
import { AccessibilityService } from './profile/services/accessibility.service';

@Component({
  selector: 'app-root',
  imports: [
    AsyncPipe,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatProgressBarModule,
    NotificationBellComponent,
    MessagesBadgeComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  private readonly _router = inject(Router);
  private readonly _loadingService = inject(LoadingService);
  private readonly _accessibilityService = inject(AccessibilityService);

  private readonly _url$ = this._router.events.pipe(
    filter((event) => event instanceof NavigationEnd),
    startWith(null),
    map(() => this._router.url),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  public readonly tabs = navigationTabs;
  public readonly roles = roleViews;
  public readonly isLoading$ = this._loadingService.isLoading$;
  public readonly isFullScreen$ = this._url$.pipe(map((url) => fullScreenRoutePrefixes.some((prefix) => url.startsWith(prefix))));
  public readonly activeRole$ = this._url$.pipe(
    map((url) => roleViews.find((view) => view.role === AppHelper.roleForUrl(url)) ?? roleViews[0]),
  );

  public ngOnInit(): void {
    this._accessibilityService.restore();
  }
}
