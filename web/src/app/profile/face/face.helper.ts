import { facePalettes, faceSize } from './face.constants';
import { IPixelFace } from './face.interfaces';

export class FaceHelper {
  public static async seedForHandle(handle: string): Promise<string> {
    const bytes = await FaceHelper._sha256(`kubequest-face:${handle.toLowerCase()}`);

    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, 16);
  }

  public static async fromSeed(seed: string): Promise<IPixelFace> {
    const bytes = await FaceHelper._sha256(seed);
    const palette = facePalettes[bytes[0] % facePalettes.length];
    const half = faceSize / 2;
    const grid: number[][] = [];

    for (let row = 0; row < faceSize; row += 1) {
      const left: number[] = [];

      for (let column = 0; column < half; column += 1) {
        const value = bytes[(row * half + column) % bytes.length];
        left.push(value % 3 === 0 ? 0 : (value % 2) + 1);
      }

      grid.push([...left, ...[...left].reverse()]);
    }

    grid[2][2] = 3;
    grid[2][faceSize - 3] = 3;
    grid[5][3] = 3;
    grid[5][4] = 3;

    return { seed, palette, grid };
  }

  private static async _sha256(text: string): Promise<Uint8Array> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));

    return new Uint8Array(digest);
  }
}
