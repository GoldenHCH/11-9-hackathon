import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import jsQR from 'jsqr';
import { MeService } from '../../core/services/me.service';
import { AlertBannerComponent } from '../../shared/components/alert-banner/alert-banner.component';
import { ScreenToolbarComponent } from '../../shared/components/screen-toolbar/screen-toolbar.component';
import { ScanHelper, pendingScanStorageKey } from '../scan.helper';

type ScannerState = 'starting' | 'scanning' | 'denied' | 'unavailable' | 'done';

interface IDetectedBarcode {
  rawValue: string;
}

interface IBarcodeDetector {
  detect(source: CanvasImageSource): Promise<IDetectedBarcode[]>;
}

interface IBarcodeDetectorConstructor {
  new (options: { formats: string[] }): IBarcodeDetector;
  getSupportedFormats?(): Promise<string[]>;
}

const decodeIntervalMs = 125;
const maxDecodeWidth = 640;
const notKubeQuestMessage = 'That isn’t a KubeQuest code';

@Component({
  selector: 'app-scanner',
  imports: [FormsModule, MatButtonModule, MatFormFieldModule, MatIconModule, MatInputModule, AlertBannerComponent, ScreenToolbarComponent],
  templateUrl: './scanner.component.html',
  styleUrl: './scanner.component.scss',
})
export class ScannerComponent implements OnInit, OnDestroy {
  private readonly _router = inject(Router);
  private readonly _zone = inject(NgZone);
  private readonly _meService = inject(MeService);

  @ViewChild('video', { static: true }) private readonly _videoRef!: ElementRef<HTMLVideoElement>;

  public state: ScannerState = 'starting';
  public errorMessage = '';
  public announcement = '';
  public manualLink = '';
  public isTorchSupported = false;
  public isTorchOn = false;

  private _stream: MediaStream | null = null;
  private _detector: IBarcodeDetector | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  private _timer: ReturnType<typeof setTimeout> | null = null;
  private _lastRejected = '';
  private _isStarting = false;
  private readonly _onVisibilityChange = (): void => this._handleVisibilityChange();

  public ngOnInit(): void {
    document.addEventListener('visibilitychange', this._onVisibilityChange);
    void this.start();
  }

  public ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this._onVisibilityChange);
    this._stopCamera();
  }

  public get isCameraActive(): boolean {
    return this.state === 'starting' || this.state === 'scanning';
  }

  public async start(): Promise<void> {
    if (this._isStarting) {
      return;
    }
    this.errorMessage = '';
    this._lastRejected = '';

    if (!navigator.mediaDevices?.getUserMedia) {
      this.state = 'unavailable';
      return;
    }

    this.state = 'starting';
    this._isStarting = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      if (document.hidden || this.state !== 'starting') {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this._stream = stream;
      const video = this._videoRef.nativeElement;
      video.srcObject = stream;
      await video.play();
      this._detector = await this._createDetector();
      this._readTorchSupport();
      this.state = 'scanning';
      this._scheduleDecode();
    } catch (error) {
      console.error('Could not start the camera', error);
      this._stopCamera();
      const name = error instanceof DOMException ? error.name : '';
      this.state = name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unavailable';
    } finally {
      this._isStarting = false;
    }
  }

  public async toggleTorch(): Promise<void> {
    const track = this._stream?.getVideoTracks()[0];
    if (!track) {
      return;
    }
    const next = !this.isTorchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      this.isTorchOn = next;
    } catch (error) {
      console.error('Could not toggle the torch', error);
      this.isTorchSupported = false;
    }
  }

  public submitManual(): void {
    this._handleValue(this.manualLink);
  }

  public dismissError(): void {
    this.errorMessage = '';
  }

  private async _createDetector(): Promise<IBarcodeDetector | null> {
    const detectorClass = (window as unknown as { BarcodeDetector?: IBarcodeDetectorConstructor }).BarcodeDetector;
    if (!detectorClass) {
      return null;
    }
    try {
      const formats = (await detectorClass.getSupportedFormats?.()) ?? ['qr_code'];
      return formats.includes('qr_code') ? new detectorClass({ formats: ['qr_code'] }) : null;
    } catch (error) {
      console.error('BarcodeDetector unavailable, using jsQR', error);
      return null;
    }
  }

  private _readTorchSupport(): void {
    const track = this._stream?.getVideoTracks()[0];
    const capabilities = track?.getCapabilities?.() as (MediaTrackCapabilities & { torch?: boolean }) | undefined;
    this.isTorchSupported = !!capabilities?.torch;
    this.isTorchOn = false;
  }

  private _scheduleDecode(): void {
    this._zone.runOutsideAngular(() => {
      this._timer = setTimeout(() => void this._decodeFrame(), decodeIntervalMs);
    });
  }

  private async _decodeFrame(): Promise<void> {
    if (this.state !== 'scanning' || !this._stream) {
      return;
    }
    const video = this._videoRef.nativeElement;
    let value: string | null = null;

    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      try {
        value = this._detector ? await this._detectNative(video) : this._detectWithJsQr(video);
      } catch (error) {
        console.error('QR decode failed, falling back to jsQR', error);
        this._detector = null;
      }
    }

    if (value && value !== this._lastRejected) {
      this._zone.run(() => this._handleValue(value as string));
    }

    if (this.state === 'scanning') {
      this._scheduleDecode();
    }
  }

  private async _detectNative(video: HTMLVideoElement): Promise<string | null> {
    const codes = await this._detector!.detect(video);
    return codes[0]?.rawValue ?? null;
  }

  private _detectWithJsQr(video: HTMLVideoElement): string | null {
    const scale = Math.min(1, maxDecodeWidth / video.videoWidth);
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    this._canvas ??= document.createElement('canvas');
    this._canvas.width = width;
    this._canvas.height = height;
    const context = this._canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(video, 0, 0, width, height);
    const image = context.getImageData(0, 0, width, height);
    return jsQR(image.data, width, height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
  }

  private _handleValue(rawValue: string): void {
    const path = ScanHelper.toInAppPath(rawValue);
    if (!path) {
      this._lastRejected = rawValue;
      this.errorMessage = notKubeQuestMessage;
      this.announcement = notKubeQuestMessage;
      return;
    }

    this.errorMessage = '';
    this.state = 'done';
    this.announcement = 'KubeQuest code found. Opening it now.';
    navigator.vibrate?.(80);
    this._stopCamera();

    if (!this._meService.attendeeId) {
      try {
        sessionStorage.setItem(pendingScanStorageKey, path);
      } catch (error) {
        console.error('Could not save the pending scan', error);
      }
      void this._router.navigateByUrl('/onboarding');
      return;
    }

    void this._router.navigateByUrl(path);
  }

  private _handleVisibilityChange(): void {
    if (document.hidden) {
      if (this.isCameraActive) {
        this._stopCamera();
        this.state = 'starting';
      }
      return;
    }
    if (this.state === 'starting' && !this._stream) {
      this._zone.run(() => void this.start());
    }
  }

  private _stopCamera(): void {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    this._stream?.getTracks().forEach((track) => track.stop());
    this._stream = null;
    this.isTorchOn = false;
    const video = this._videoRef?.nativeElement;
    if (video) {
      video.srcObject = null;
    }
  }
}
