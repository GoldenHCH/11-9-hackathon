import { A11yModule } from '@angular/cdk/a11y';
import { Component, DestroyRef, ElementRef, HostListener, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { PixelFaceComponent } from '../../shared/components/pixel-face/pixel-face.component';
import { photoEmptyLine } from '../photos.constants';
import { IBoothPhoto, IBoothPhotoList, IDeleteBoothPhotoResult, IReportBoothPhotoResult } from '../photos.types';

const minuteMs = 60_000;

@Component({
  selector: 'app-booth-photos',
  imports: [A11yModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule, AlertBannerComponent, PixelFaceComponent],
  templateUrl: './booth-photos.component.html',
  styleUrl: './booth-photos.component.scss',
})
export class BoothPhotosComponent implements OnChanges {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _host = inject<ElementRef<HTMLElement>>(ElementRef);
  private _returnFocus: HTMLElement | null = null;

  @Input({ required: true }) public locationId = '';
  @Input() public limit = 12;

  public readonly emptyLine = photoEmptyLine;
  public photos: IBoothPhoto[] = [];
  public count = 0;
  public isLoading = false;
  public errorMessage = '';
  public notice = '';
  public busyIds = new Set<string>();
  public enlarged: IBoothPhoto | null = null;

  public get isSignedIn(): boolean {
    return this._meService.attendeeId !== null;
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['locationId'] && this.locationId) {
      this.load();
    }
  }

  @HostListener('document:keydown.escape')
  public onEscape(): void {
    if (this.enlarged) {
      this.closeLightbox();
    }
  }

  public load(): void {
    this.isLoading = true;
    this.errorMessage = '';
    const attendeeId = this._meService.attendeeId;
    this._toolsService
      .call<IBoothPhotoList>('list_booth_photos', { locationId: this.locationId, limit: this.limit, ...(attendeeId ? { attendeeId } : {}) }, { background: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (list) => {
          this.photos = list.photos;
          this.count = list.count;
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Could not load booth photos', error);
          this.errorMessage = ApiErrorHelper.message(error);
          this.isLoading = false;
        },
      });
  }

  public relativeTime(iso: string): string {
    const minutes = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / minuteMs));

    if (minutes < 1) {
      return 'just now';
    }

    if (minutes < 60) {
      return `${minutes} min ago`;
    }

    const hours = Math.round(minutes / 60);

    return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
  }

  public openLightbox(photo: IBoothPhoto, event: Event): void {
    this._returnFocus = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
    this.enlarged = photo;
  }

  public closeLightbox(): void {
    this.enlarged = null;
    const target = this._returnFocus;
    this._returnFocus = null;
    setTimeout(() => (target && this._host.nativeElement.contains(target) ? target.focus() : undefined));
  }

  public report(photo: IBoothPhoto): void {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId || this.busyIds.has(photo.id)) {
      return;
    }

    this.busyIds.add(photo.id);
    this._toolsService
      .call<IReportBoothPhotoResult>('report_booth_photo', { attendeeId, photoId: photo.id }, { background: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (result) => {
          this.busyIds.delete(photo.id);
          this.notice = result.message;

          if (result.hidden) {
            this.removeLocally(photo.id);
          }
        },
        error: (error: unknown) => {
          console.error('Could not report the photo', error);
          this.busyIds.delete(photo.id);
          this.errorMessage = ApiErrorHelper.message(error);
        },
      });
  }

  public remove(photo: IBoothPhoto): void {
    const attendeeId = this._meService.attendeeId;

    if (!attendeeId || this.busyIds.has(photo.id)) {
      return;
    }

    this.busyIds.add(photo.id);
    this._toolsService
      .call<IDeleteBoothPhotoResult>('delete_booth_photo', { attendeeId, photoId: photo.id }, { background: true })
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: () => {
          this.busyIds.delete(photo.id);
          this.notice = 'Your photo is deleted.';
          this.removeLocally(photo.id);
        },
        error: (error: unknown) => {
          console.error('Could not delete the photo', error);
          this.busyIds.delete(photo.id);
          this.errorMessage = ApiErrorHelper.message(error);
        },
      });
  }

  private removeLocally(photoId: string): void {
    this.photos = this.photos.filter((photo) => photo.id !== photoId);
    this.count = Math.max(0, this.count - 1);

    if (this.enlarged?.id === photoId) {
      this.closeLightbox();
    }
  }
}
