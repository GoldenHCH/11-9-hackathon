import { AsyncPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { filter, map, startWith } from 'rxjs';
import { fullScreenRoutePrefixes, navigationTabs } from './app.constants';
import { LoadingService } from './core/services/loading.service';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, RouterOutlet, RouterLink, RouterLinkActive, MatIconModule, MatProgressBarModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly _router = inject(Router);
  private readonly _loadingService = inject(LoadingService);

  public readonly tabs = navigationTabs;
  public readonly isLoading$ = this._loadingService.isLoading$;
  public readonly isFullScreen$ = this._router.events.pipe(
    filter((event) => event instanceof NavigationEnd),
    startWith(null),
    map(() => fullScreenRoutePrefixes.some((prefix) => this._router.url.startsWith(prefix))),
  );
}
