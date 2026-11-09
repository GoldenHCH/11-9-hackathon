import { Component, Input } from '@angular/core';

interface IPixelCell {
  x: number;
  y: number;
  fill: string;
}

const gridSize = 8;
const palettes = [
  ['#2f6b2b', '#8bd17c'],
  ['#1565c0', '#90caf9'],
  ['#c96a12', '#ffcc80'],
  ['#6a1b9a', '#ce93d8'],
  ['#00695c', '#80cbc4'],
  ['#ad1457', '#f48fb1'],
] as const;

@Component({
  selector: 'app-pixel-face',
  template: `
    <svg
      class="face"
      [attr.width]="size"
      [attr.height]="size"
      [attr.viewBox]="'0 0 ' + gridSize + ' ' + gridSize"
      shape-rendering="crispEdges"
      role="img"
      [attr.aria-label]="label || 'Player face'"
    >
      <rect x="0" y="0" [attr.width]="gridSize" [attr.height]="gridSize" [attr.fill]="background"></rect>
      @for (cell of cells; track cell.x + '-' + cell.y) {
        <rect [attr.x]="cell.x" [attr.y]="cell.y" width="1" height="1" [attr.fill]="cell.fill"></rect>
      }
    </svg>
  `,
  styles: [
    `
      .face {
        display: block;
        border: 2px solid var(--app-theme--border);
        box-shadow: var(--app-theme--shadow-small);
      }
    `,
  ],
})
export class PixelFaceComponent {
  @Input({ required: true }) public seed = '';
  @Input() public size = 48;
  @Input() public label = '';

  public readonly gridSize = gridSize;

  public get background(): string {
    return this._palette()[1];
  }

  public get cells(): IPixelCell[] {
    const hash = this._hash(this.seed);
    const foreground = this._palette()[0];
    const cells: IPixelCell[] = [];

    for (let y = 1; y < gridSize - 1; y++) {
      for (let x = 1; x < gridSize / 2; x++) {
        const bitIndex = (y * gridSize + x) % 31;

        if ((hash >>> bitIndex) & 1) {
          cells.push({ x, y, fill: foreground });
          cells.push({ x: gridSize - 1 - x, y, fill: foreground });
        }
      }
    }

    return cells;
  }

  private _palette(): readonly [string, string] {
    return palettes[this._hash(`${this.seed}:palette`) % palettes.length];
  }

  private _hash(text: string): number {
    let hash = 2166136261;

    for (const character of text) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }

    return hash >>> 0;
  }
}
