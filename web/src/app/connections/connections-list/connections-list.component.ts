import { DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { IConnection, LinkNetwork } from '../../core/api.types';
import { linkNetworkColors, linkNetworkOptions } from '../../links/links.constants';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';

@Component({
  selector: 'app-connections-list',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, PixelFaceComponent, ScreenToolbarComponent, StateWrapperComponent],
  templateUrl: './connections-list.component.html',
  styleUrl: './connections-list.component.scss',
})
export class ConnectionsListComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);

  public connections: IConnection[] = [];
  public isLoading = true;
  public errorMessage = '';

  public ngOnInit(): void {
    this.loadConnections();
  }

  public loadConnections(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._toolsService
      .call<IConnection[]>('list_connections', { attendeeId: this._meService.attendeeId })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (connections) => {
          this.connections = connections;
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Could not load your connections', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public glyph(network: LinkNetwork): string {
    return linkNetworkOptions.find((option) => option.network === network)?.glyph ?? '';
  }

  public networkLabel(network: LinkNetwork): string {
    return linkNetworkOptions.find((option) => option.network === network)?.label ?? network;
  }

  public color(network: LinkNetwork): string {
    return linkNetworkColors[network];
  }

  public openCode(): void {
    void this._router.navigate(['/code']);
  }
}
