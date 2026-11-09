import { Component, Input, OnChanges } from '@angular/core';

const gridSize = 8;
const palette = ['#2f6b2b', '#c96a12', '#1565c0', '#8e44ad', '#b03a2e', '#117a65', '#7d6608', '#2e4053'];

interface IPixel {
  x: number;
  y: number;
}

@Component({
  selector: 'app-pixel-face',
  templateUrl: './pixel-face.component.html',
  styleUrl: './pixel-face.component.scss',
})
export class PixelFaceComponent implements OnChanges {
  @Input({ required: true }) public seed = '';
  @Input({ required: true }) public handle = '';
  @Input() public size = 32;

  public pixels: IPixel[] = [];
  public color = palette[0];

  public ngOnChanges(): void {
    let hash = 2166136261;

    for (const character of this.seed || this.handle) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619) >>> 0;
    }

    this.color = palette[hash % palette.length] ?? palette[0];
    this.pixels = [];

    for (let y = 0; y < gridSize; y++) {
      for (let x = 0; x < gridSize / 2; x++) {
        hash = Math.imul(hash ^ (hash >>> 13), 2654435761) >>> 0;

        if (hash % 100 < 48) {
          this.pixels.push({ x, y }, { x: gridSize - 1 - x, y });
        }
      }
    }
  }
}
