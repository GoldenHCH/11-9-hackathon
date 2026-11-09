export const UNIT = 24;

export type Vec = readonly [number, number];

export const project = (x: number, y: number, z: number, s = UNIT): Vec => [
  (x - y) * s,
  ((x + y) * s) / 2 - z * s,
];

export const axis = (s = UNIT) => ({
  x: [s, s / 2] as Vec,
  y: [-s, s / 2] as Vec,
  down: [0, s] as Vec,
});

export const matrix = (o: Vec, e1: Vec, e2: Vec) =>
  `matrix(${e1[0]} ${e1[1]} ${e2[0]} ${e2[1]} ${o[0]} ${o[1]})`;

export type Material =
  | 'circuit'
  | 'stone'
  | 'glass'
  | 'crate'
  | 'iron'
  | 'copper'
  | 'lantern'
  | 'wood'
  | 'salt'
  | 'path'
  | 'wall'
  | 'ember'
  | 'qr'
  | 'kube'
  | 'gem'
  | 'roof'
  | 'pine';

export type Block = {
  x: number;
  y: number;
  z: number;
  w?: number;
  d?: number;
  h?: number;
  m: Material;
  top?: Material;
  key?: string;
};

export const depth = (b: Block) =>
  b.x + (b.w ?? 1) / 2 + b.y + (b.d ?? 1) / 2 + b.z * 0.01;

export const byDepth = (a: Block, b: Block) => depth(a) - depth(b);

export const box = (
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  m: Material,
  top?: Material,
): Block[] => {
  const out: Block[] = [];
  for (let i = 0; i < w; i++)
    for (let j = 0; j < d; j++)
      for (let k = 0; k < h; k++)
        out.push({ x: x + i, y: y + j, z: z + k, m, top: k === h - 1 ? top : undefined });
  return out;
};
