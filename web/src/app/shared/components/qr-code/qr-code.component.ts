import { Component, Input, OnChanges, ViewEncapsulation } from '@angular/core';
import { toDataURL } from 'qrcode';

const renderWidthPx = 720;

@Component({
  selector: 'app-qr-code',
  templateUrl: './qr-code.component.html',
  styleUrl: './qr-code.component.scss',
  encapsulation: ViewEncapsulation.None,
})
export class QrCodeComponent implements OnChanges {
  @Input({ required: true }) public value = '';
  @Input({ required: true }) public alt = '';
  @Input() public size = 240;

  public imageUrl = '';
  public hasFailed = false;

  private _renderedValue = '';

  public ngOnChanges(): void {
    if (this.value === this._renderedValue) {
      return;
    }

    this._renderedValue = this.value;
    this.hasFailed = false;

    if (!this.value) {
      this.imageUrl = '';

      return;
    }

    const requestedValue = this.value;

    toDataURL(requestedValue, { errorCorrectionLevel: 'M', margin: 2, width: renderWidthPx })
      .then((dataUrl) => {
        if (requestedValue === this._renderedValue) {
          this.imageUrl = dataUrl;
        }
      })
      .catch((error: unknown) => {
        console.error('QR code failed to render', error);
        this.hasFailed = true;
      });
  }
}
