import { ChangeDetectorRef, Component, Input, OnChanges, inject } from '@angular/core';
import { FaceHelper } from './face.helper';

@Component({
  selector: 'app-block-face',
  template: `
    <div
      class="face"
      role="img"
      [attr.aria-label]="label || 'Pixel face'"
      [style.width.px]="size"
      [style.height.px]="size"
    >
      @for (color of cells; track $index) {
        <span class="cell" [style.background]="color"></span>
      }
    </div>
  `,
  styles: [
    `
      :host {
        display: inline-block;
        line-height: 0;
      }

      .face {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        grid-template-rows: repeat(8, 1fr);
        border: 2px solid var(--kq-border);
        box-shadow: var(--kq-shadow);
        background: var(--kq-surface-2);
        box-sizing: content-box;
      }

      .cell {
        display: block;
      }
    `,
  ],
})
export class BlockFaceComponent implements OnChanges {
  private readonly _changeDetectorRef = inject(ChangeDetectorRef);
  private _requestId = 0;

  @Input() public seed = '';
  @Input() public handle = '';
  @Input() public size = 64;
  @Input() public label = '';

  public cells: string[] = [];

  public ngOnChanges(): void {
    void this._render();
  }

  private async _render(): Promise<void> {
    const requestId = ++this._requestId;

    if (!this.seed && !this.handle) {
      this.cells = [];
      this._changeDetectorRef.markForCheck();
      return;
    }

    try {
      const seed = this.seed || (await FaceHelper.seedForHandle(this.handle));
      const face = await FaceHelper.fromSeed(seed);

      if (requestId !== this._requestId) {
        return;
      }

      this.cells = face.grid.flat().map((value) => face.palette[value] ?? face.palette[0]);
    } catch (error) {
      console.error('Could not draw the pixel face', error);
      this.cells = [];
    }

    this._changeDetectorRef.markForCheck();
  }
}
