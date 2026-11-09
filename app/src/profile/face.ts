import { createHash } from 'node:crypto';
import { facePalettes, signupLimits } from './profile.constants';

export interface IPixelFace {
  seed: string;
  palette: string[];
  grid: number[][];
}

export function faceSeedFor(handle: string): string {
  return createHash('sha256').update(`kubequest-face:${handle.toLowerCase()}`).digest('hex').slice(0, 16);
}

export function pixelFace(seed: string): IPixelFace {
  const bytes = createHash('sha256').update(seed).digest();
  const palette = facePalettes[bytes[0] % facePalettes.length];
  const size = signupLimits.FACE_SIZE;
  const half = size / 2;
  const grid: number[][] = [];

  for (let row = 0; row < size; row += 1) {
    const left: number[] = [];

    for (let column = 0; column < half; column += 1) {
      const value = bytes[(row * half + column) % bytes.length];
      left.push(value % 3 === 0 ? 0 : (value % 2) + 1);
    }

    grid.push([...left, ...[...left].reverse()]);
  }

  grid[2][2] = 3;
  grid[2][size - 3] = 3;
  grid[5][3] = 3;
  grid[5][4] = 3;

  return { seed, palette, grid };
}
