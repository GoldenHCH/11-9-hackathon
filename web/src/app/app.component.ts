import { AsyncPipe } from '@angular/common';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';

import { LoadingService } from './core/services/loading.service';

@Component({
  selector: 'app-root',
  imports: [AsyncPipe, MatIconModule, MatProgressBarModule, MatToolbarModule, RouterLink, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  @ViewChild('mainContent', { static: true }) private _mainContent!: ElementRef<HTMLElement>;

  private readonly _loadingService = inject(LoadingService);

  public readonly isLoading$ = this._loadingService.isLoading$;

  public skipToContent(event: Event): void {
    event.preventDefault();
    this._mainContent.nativeElement.focus();
  }
}
