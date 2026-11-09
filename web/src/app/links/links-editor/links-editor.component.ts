import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { ILinkItem, IProfile, IProfileLinks, IUpdateLinksResult, LinkNetwork } from '../../core/api.types';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { StateWrapperComponent } from '../../shared/components/state-wrapper/state-wrapper.component';
import { LinkChipsComponent } from '../link-chips/link-chips.component';
import { linkNetworkColors, linkNetworkOptions } from '../links.constants';

@Component({
  selector: 'app-links-editor',
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    AlertBannerComponent,
    LinkChipsComponent,
    ScreenToolbarComponent,
    StateWrapperComponent,
  ],
  templateUrl: './links-editor.component.html',
  styleUrl: './links-editor.component.scss',
})
export class LinksEditorComponent implements OnInit {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _destroyRef = inject(DestroyRef);

  public readonly options = linkNetworkOptions;
  public readonly colors = linkNetworkColors;
  public values: Record<LinkNetwork, string> = { linkedin: '', github: '', x: '', bluesky: '', mastodon: '', website: '' };
  public items: ILinkItem[] = [];
  public isLoading = true;
  public isSaving = false;
  public errorMessage = '';
  public saveError = '';
  public savedMessage = '';

  public ngOnInit(): void {
    this.loadLinks();
  }

  public loadLinks(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this._toolsService
      .call<IProfile>('get_profile', { attendeeId: this._meService.attendeeId })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (profile) => {
          this._applyLinks(profile.attendee.links ?? {});
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Could not load your links', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public onSave(): void {
    if (this.isSaving) {
      return;
    }

    this.isSaving = true;
    this.saveError = '';
    this.savedMessage = '';
    this._toolsService
      .call<IUpdateLinksResult>('update_links', { attendeeId: this._meService.attendeeId, links: { ...this.values } })
      .pipe(
        finalize(() => (this.isSaving = false)),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (result) => {
          this._applyLinks(result.links);
          const enriched = result.enrichment.filter((entry) => entry.status === 'added').map((entry) => (entry.network === 'github' ? 'GitHub' : 'Bluesky'));
          this.savedMessage = enriched.length
            ? `Saved. We read your public ${enriched.join(' and ')} profile to find better matches.`
            : 'Saved. Only people you meet can see these.';
        },
        error: (error: unknown) => {
          console.error('Could not save your links', error);
          this.saveError = ApiErrorHelper.message(error);
        },
      });
  }

  private _applyLinks(links: IProfileLinks): void {
    this.values = {
      linkedin: links.linkedin ?? '',
      github: links.github ?? '',
      x: links.x ?? '',
      bluesky: links.bluesky ?? '',
      mastodon: links.mastodon ?? '',
      website: links.website ?? '',
    };
    this.items = this.options.flatMap((option) => {
      const url = links[option.network];

      return url ? [{ network: option.network, label: url.replace(/^https:\/\/(www\.)?/, ''), url }] : [];
    });
  }
}
