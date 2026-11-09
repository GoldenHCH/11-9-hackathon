import { Component, DestroyRef, ElementRef, EventEmitter, Input, Output, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { finalize } from 'rxjs';
import { ApiErrorHelper } from '../../core/helpers/api-error.helper';
import { MeService } from '../../core/services/me.service';
import { ToolsService } from '../../core/services/tools.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { IResizedPhoto, PhotoResizeHelper } from '../photo-resize.helper';
import { photoCaptionMaxChars, photoSafetyLine } from '../photos.constants';
import { IUploadBoothPhotoResult, PhotoCaptureStep } from '../photos.types';

@Component({
  selector: 'app-photo-capture',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, MatProgressSpinnerModule, AlertBannerComponent],
  templateUrl: './photo-capture.component.html',
  styleUrl: './photo-capture.component.scss',
})
export class PhotoCaptureComponent {
  private readonly _toolsService = inject(ToolsService);
  private readonly _meService = inject(MeService);
  private readonly _destroyRef = inject(DestroyRef);

  @ViewChild('fileInput') private readonly _fileInput?: ElementRef<HTMLInputElement>;

  @Input({ required: true }) public locationId = '';
  @Input() public boothName = '';
  @Output() public readonly uploaded = new EventEmitter<IUploadBoothPhotoResult>();

  public readonly safetyLine = photoSafetyLine;
  public readonly captionMaxChars = photoCaptionMaxChars;
  public step: PhotoCaptureStep = 'idle';
  public photo: IResizedPhoto | null = null;
  public caption = '';
  public errorMessage = '';
  public resultMessage = '';

  public openCamera(): void {
    this.errorMessage = '';
    this._fileInput?.nativeElement.click();
  }

  public async onFileChosen(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    this.step = 'preparing';

    try {
      this.photo = await PhotoResizeHelper.resize(file);
      this.step = 'preview';
    } catch (error) {
      console.error('Could not prepare the photo', error);
      this.errorMessage = error instanceof Error ? error.message : 'Could not read that photo.';
      this.step = 'idle';
    }
  }

  public retake(): void {
    this.photo = null;
    this.step = 'idle';
    this.openCamera();
  }

  public cancel(): void {
    this.photo = null;
    this.caption = '';
    this.errorMessage = '';
    this.step = 'idle';
  }

  public upload(): void {
    if (!this.photo || this.step === 'uploading') {
      return;
    }

    this.step = 'uploading';
    this.errorMessage = '';
    this._toolsService
      .call<IUploadBoothPhotoResult>('upload_booth_photo', {
        attendeeId: this._meService.attendeeId,
        locationId: this.locationId,
        image: this.photo.dataUrl,
        caption: this.caption.trim() || undefined,
      })
      .pipe(
        finalize(() => {
          if (this.step === 'uploading') {
            this.step = 'preview';
          }
        }),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe({
        next: (result) => {
          this.resultMessage = result.message;
          this.photo = null;
          this.caption = '';
          this.step = 'done';
          this.uploaded.emit(result);
        },
        error: (error: unknown) => {
          console.error('Could not upload the photo', error);
          this.errorMessage = ApiErrorHelper.message(error);
        },
      });
  }
}
