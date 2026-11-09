import { memo } from 'react';
import { axis, matrix, project, UNIT, type Block, type Material, type Vec } from '../engine/iso';
import { MATERIALS } from '../engine/materials';

const INK = '#16183a';
const PX = 1 / 8;

const colorFor = (m: Material, c: string) => {
  const s = MATERIALS[m];
  if (c === 'd') return s.dark;
  if (c === 'l') return s.light;
  if (c === 'a') return s.accent;
  return null;
};

export const IsoDefs = memo(function IsoDefs() {
  return (
    <defs>
      {(Object.keys(MATERIALS) as Material[]).map((m) => (
        <pattern key={m} id={`mat-${m}`} width="1" height="1" patternUnits="userSpaceOnUse">
          <rect width="1" height="1" fill={MATERIALS[m].base} />
          {MATERIALS[m].rows.flatMap((row, j) =>
            [...row].map((c, i) => {
              const fill = colorFor(m, c);
              return fill ? (
                <rect key={`${i}-${j}`} x={i * PX} y={j * PX} width={PX + 0.004} height={PX + 0.004} fill={fill} />
              ) : null;
            }),
          )}
        </pattern>
      ))}
    </defs>
  );
});

type FaceProps = {
  o: Vec;
  e1: Vec;
  e2: Vec;
  w: number;
  h: number;
  m: Material;
  shade: number;
  glow?: number;
  outline?: number;
};

const Face = ({ o, e1, e2, w, h, m, shade, glow = 0, outline = 0.45 }: FaceProps) => (
  <g transform={matrix(o, e1, e2)}>
    <rect width={w} height={h} fill={`url(#mat-${m})`} />
    {shade > 0 && <rect width={w} height={h} fill={INK} opacity={shade} />}
    {glow > 0 && <rect width={w} height={h} fill="#ffffff" opacity={glow} />}
    <rect
      width={w}
      height={h}
      fill="none"
      stroke={INK}
      strokeOpacity={outline}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
    />
  </g>
);

export type BlockStyle = { glow?: number; lift?: number; s?: number; outline?: number };

export const BlockView = memo(function BlockView({ b, glow = 0, lift = 0, s = UNIT, outline }: { b: Block } & BlockStyle) {
  const w = b.w ?? 1;
  const d = b.d ?? 1;
  const h = b.h ?? 1;
  const z = b.z + lift;
  const a = axis(s);
  return (
    <g>
      <Face o={project(b.x, b.y, z + h, s)} e1={a.x} e2={a.y} w={w} h={d} m={b.top ?? b.m} shade={0} glow={glow} outline={outline} />
      <Face o={project(b.x + w, b.y, z + h, s)} e1={a.y} e2={a.down} w={d} h={h} m={b.m} shade={0.34} glow={glow * 0.6} outline={outline} />
      <Face o={project(b.x, b.y + d, z + h, s)} e1={a.x} e2={a.down} w={w} h={h} m={b.m} shade={0.16} glow={glow * 0.8} outline={outline} />
    </g>
  );
});

const hash = (str: string) => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
};

const SKIN = ['#f5d0b0', '#e0ac85', '#c68863', '#8d5a3b', '#5e3a24', '#ffd9c2'];
const HAIR = ['#16183a', '#5a3a1e', '#c9431c', '#f6b93b', '#7b4fd6', '#1f9e93', '#e85d9a'];
const SHIRT = ['#326ce5', '#ff6b3d', '#4cb36b', '#7b4fd6', '#f6b93b', '#1f9e93'];

export const faceGrid = (handle: string) => {
  const h = hash(handle);
  const skin = SKIN[h % SKIN.length];
  const hair = HAIR[(h >>> 3) % HAIR.length];
  const shirt = SHIRT[(h >>> 7) % SHIRT.length];
  const style = (h >>> 11) % 4;
  const cells: string[][] = Array.from({ length: 8 }, () => Array(8).fill(skin));
  for (let x = 0; x < 8; x++) {
    cells[0][x] = hair;
    if (style !== 1) cells[1][x] = hair;
  }
  if (style === 2) for (let y = 2; y < 5; y++) (cells[y][0] = hair), (cells[y][7] = hair);
  if (style === 3) (cells[2][0] = hair), (cells[2][7] = hair), (cells[2][1] = hair);
  cells[3][2] = '#16183a';
  cells[3][5] = '#16183a';
  if ((h >>> 13) % 3 === 0) {
    cells[3][1] = '#16183a';
    cells[3][3] = '#16183a';
    cells[3][4] = '#16183a';
    cells[3][6] = '#16183a';
  }
  cells[5][3] = '#c9431c';
  cells[5][4] = '#c9431c';
  if ((h >>> 15) % 2 === 0) (cells[5][2] = '#c9431c'), (cells[5][5] = '#c9431c');
  for (let x = 0; x < 8; x++) cells[7][x] = shirt;
  cells[6][0] = shirt;
  cells[6][7] = shirt;
  return { cells, shirt };
};

export const PixelFace = memo(function PixelFace({ handle, size = 48, label }: { handle: string; size?: number; label?: string }) {
  const { cells } = faceGrid(handle);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      role="img"
      aria-label={label ?? `Pixel face for ${handle}`}
      className="pixel-face"
    >
      {cells.flatMap((row, y) => row.map((fill, x) => <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={fill} />))}
    </svg>
  );
});

export const Player = memo(function Player({ x, y, handle, hop = 0, s = UNIT }: { x: number; y: number; handle: string; hop?: number; s?: number }) {
  const { cells, shirt } = faceGrid(handle);
  const a = axis(s);
  const z = hop;
  const bx = x + 0.28;
  const by = y + 0.28;
  const head = { x: x + 0.18, y: y + 0.18, z: z + 0.5, w: 0.64, d: 0.64, h: 0.64 };
  const shadow = project(x + 0.5, y + 0.5, 0, s);
  return (
    <g>
      <ellipse cx={shadow[0]} cy={shadow[1]} rx={s * 0.42} ry={s * 0.2} fill={INK} opacity={0.22 - hop * 0.2} />
      <g>
        <rect
          transform={matrix(project(bx + 0.44, by, z + 0.5, s), a.y, a.down)}
          width={0.44}
          height={0.5}
          fill={shirt}
        />
        <rect transform={matrix(project(bx + 0.44, by, z + 0.5, s), a.y, a.down)} width={0.44} height={0.5} fill={INK} opacity={0.34} />
        <rect transform={matrix(project(bx, by + 0.44, z + 0.5, s), a.x, a.down)} width={0.44} height={0.5} fill={shirt} />
        <rect transform={matrix(project(bx, by + 0.44, z + 0.5, s), a.x, a.down)} width={0.44} height={0.5} fill={INK} opacity={0.14} />
      </g>
      <BlockView b={{ ...head, m: 'salt' }} s={s} outline={0.6} />
      <g transform={matrix(project(head.x, head.y + head.d, head.z + head.h, s), [a.x[0] * head.w, a.x[1] * head.w], [0, s * head.h])}>
        {cells.flatMap((row, j) =>
          row.map((fill, i) => <rect key={`${i}-${j}`} x={i / 8} y={j / 8} width={0.13} height={0.13} fill={fill} />),
        )}
      </g>
      <g transform={matrix(project(head.x, head.y, head.z + head.h, s), [a.x[0] * head.w, a.x[1] * head.w], [a.y[0] * head.d, a.y[1] * head.d])}>
        <rect width={1} height={1} fill={cells[0][0]} />
      </g>
      <g transform={matrix(project(head.x + head.w, head.y, head.z + head.h, s), [a.y[0] * head.d, a.y[1] * head.d], [0, s * head.h])}>
        <rect width={1} height={1} fill={cells[4][0]} />
        <rect width={1} height={0.25} fill={cells[0][0]} />
        <rect width={1} height={1} fill={INK} opacity={0.3} />
      </g>
    </g>
  );
});
