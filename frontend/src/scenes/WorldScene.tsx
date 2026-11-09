import { memo } from 'react';
import { BlockView, IsoDefs, Player } from '../components/Iso';
import { box, byDepth, project, type Block, type Material } from '../engine/iso';
import { easeOut } from '../engine/time';
import { FIRE, HANDLES, QR_A, type WorldState } from './timeline';

const ROOM_ROW: Material[] = ['circuit', 'stone', 'glass', 'crate', 'iron', 'copper', 'lantern'];

const pathTiles = () => {
  const cells = new Set<string>();
  for (let x = 0; x < 16; x++) cells.add(`${x},7`);
  [5, 6].forEach((y) => cells.add(`3,${y}`));
  [4, 5, 6].forEach((y) => cells.add(`11,${y}`));
  [8, 9, 10].forEach((y) => cells.add(`7,${y}`));
  [8, 9, 10].forEach((y) => cells.add(`9,${y}`));
  [8, 10].forEach((y) => cells.add(`8,${y}`));
  return [...cells].map((c) => {
    const [x, y] = c.split(',').map(Number);
    return { x, y, z: 0, h: 0.06, m: 'path' as Material };
  });
};

const buildWorld = (): Block[] => {
  const palace = [
    ...box(1, 1, 0, 7, 3, 3, 'wall', 'roof'),
    ...ROOM_ROW.flatMap((m, i) => box(1 + i, 4, 0, 1, 1, 2, m, 'roof')),
  ];
  const hyatt = [...box(10, 1, 0, 3, 3, 5, 'glass', 'glass'), ...box(10, 1, 5, 3, 3, 1, 'iron', 'roof')];
  const bridge = box(8, 2, 2, 2, 1, 1, 'iron', 'glass');
  const booths = [...box(13, 9, 0, 1, 1, 1, 'crate', 'copper'), ...box(14, 9, 0, 1, 1, 1, 'crate', 'circuit'), ...box(13, 11, 0, 2, 1, 1, 'crate', 'lantern')];
  const seats = [
    { x: 7, y: 11, z: 0, h: 0.4, m: 'wood' as Material },
    { x: 9, y: 11, z: 0, h: 0.4, m: 'wood' as Material },
    { x: 6, y: 9, z: 0, h: 0.4, m: 'wood' as Material },
  ];
  const pine = (x: number, y: number): Block[] => [
    { x: x + 0.3, y: y + 0.3, z: 0, w: 0.4, d: 0.4, h: 0.5, m: 'wood' },
    { x: x - 0.1, y: y - 0.1, z: 0.5, w: 1.2, d: 1.2, h: 0.6, m: 'pine' },
    { x: x + 0.1, y: y + 0.1, z: 1.1, w: 0.8, d: 0.8, h: 0.6, m: 'pine' },
    { x: x + 0.3, y: y + 0.3, z: 1.7, w: 0.4, d: 0.4, h: 0.5, m: 'pine', top: 'salt' },
  ];
  const trees = [...pine(0, 10), ...pine(15, 3), ...pine(0.2, 8.6), ...pine(15, 5)];
  return [...palace, ...hyatt, ...bridge, ...booths, ...seats, ...trees].sort(byDepth);
};

const WORLD = buildWorld();
const PATHS = pathTiles();
const GROUND: Block = { x: 0, y: 0, z: -1, w: 16, d: 12, h: 1, m: 'salt' };

const StaticWorld = memo(function StaticWorld() {
  return (
    <g>
      <BlockView b={GROUND} outline={0.6} />
      {PATHS.map((b) => (
        <BlockView key={`p${b.x},${b.y}`} b={b} outline={0.12} />
      ))}
      {WORLD.map((b) => (
        <BlockView key={`${b.x},${b.y},${b.z}`} b={b} outline={0.38} />
      ))}
    </g>
  );
});

const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = Math.sin(i * 91.7) * 10000;
  const q = Math.sin(i * 37.3) * 10000;
  return { x: (r - Math.floor(r)) * 1600, y: (q - Math.floor(q)) * 330, s: i % 6 === 0 ? 6 : 3, k: i };
});

const ridge = (points: number[], base: number, step: number, x0: number) => {
  let d = `M${x0} ${base}`;
  points.forEach((h, i) => {
    d += ` V${base - h} H${x0 + (i + 1) * step}`;
  });
  return `${d} V${base + 400} H${x0} Z`;
};

const FAR = [60, 90, 120, 150, 190, 230, 210, 250, 290, 270, 230, 200, 170, 200, 240, 220, 180, 140, 110, 140, 170, 150, 120, 90, 70, 100, 80, 60, 40, 30];
const NEAR = [40, 70, 110, 90, 130, 160, 140, 110, 90, 120, 150, 130, 100, 80, 60, 90, 120, 140, 110, 80, 60, 40, 70, 90, 70, 50, 30, 20, 40, 30];

export const SkyLayer = ({ t, shift = 0 }: { t: number; shift?: number }) => {
  const twinkle = Math.floor(t * 3);
  return (
    <g>
      <rect x={0} y={0} width={1600} height={1000} fill="#1a1c45" />
      <rect x={0} y={300} width={1600} height={700} fill="#222562" />
      {STARS.map((st) => (
        <rect key={st.k} x={st.x} y={st.y} width={st.s} height={st.s} fill="#e9eef2" opacity={(st.k + twinkle) % 7 === 0 ? 0.25 : 0.8} />
      ))}
      <g transform={`translate(${shift * 0.3} 0)`}>
        <path d={ridge(FAR, 560, 56, -40)} fill="#363b83" />
        {FAR.map((h, i) =>
          h >= 230 ? <rect key={i} x={-40 + i * 56} y={560 - h} width={56} height={14} fill="#e9eef2" opacity={0.9} /> : null,
        )}
      </g>
      <g transform={`translate(${shift * 0.6} 0)`}>
        <path d={ridge(NEAR, 640, 56, -20)} fill="#454b9a" />
      </g>
    </g>
  );
};

export const Sky = ({ t, shift = 0 }: { t: number; shift?: number }) => (
  <svg className="sky" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <SkyLayer t={t} shift={shift} />
  </svg>
);

const Fire = ({ t, flare }: { t: number; flare: number }) => {
  const [cx, cy] = project(FIRE.x + 0.5, FIRE.y + 0.5, 0.5);
  const frame = Math.floor(t * 9) % 3;
  const tall = 1 + flare * 1.2;
  const cols = [
    [-9, 10 + frame * 3, '#ff6b3d'],
    [-3, 18 - frame * 2, '#ff6b3d'],
    [3, 14 + ((frame + 1) % 3) * 3, '#ff6b3d'],
    [-6, 8 + ((frame + 2) % 3) * 2, '#ffc83d'],
    [0, 12 + frame * 2, '#ffc83d'],
    [-3, 5 + frame, '#fff2c4'],
  ] as const;
  return (
    <g>
      <BlockView b={{ x: FIRE.x + 0.1, y: FIRE.y + 0.1, z: 0, w: 0.8, d: 0.8, h: 0.25, m: 'wood' }} />
      <BlockView b={{ x: FIRE.x + 0.3, y: FIRE.y + 0.3, z: 0.25, w: 0.4, d: 0.4, h: 0.25, m: 'ember' }} glow={flare * 0.5} />
      {flare > 0 && <circle cx={cx} cy={cy - 10} r={40 + flare * 30} fill="#ffc83d" opacity={flare * 0.18} />}
      {cols.map(([dx, h, fill], i) => (
        <rect key={i} x={cx + dx} y={cy - 6 - h * tall} width={6} height={h * tall} fill={fill} />
      ))}
    </g>
  );
};

const Ring = ({ p }: { p: number }) => {
  const r = 0.3 + easeOut(p) * 1.4;
  const c = { x: QR_A.x + 0.3, y: QR_A.y + 0.4 };
  const pts = [
    project(c.x - r, c.y - r, 0.07),
    project(c.x + r, c.y - r, 0.07),
    project(c.x + r, c.y + r, 0.07),
    project(c.x - r, c.y + r, 0.07),
  ];
  return (
    <polygon
      points={pts.map((q) => q.join(',')).join(' ')}
      fill="none"
      stroke="#ffc83d"
      strokeWidth={4}
      opacity={1 - p}
    />
  );
};

const PopText = ({ text, x, y, z, p, tone }: { text: string; x: number; y: number; z: number; p: number; tone: 'xp' | 'gem' }) => {
  const [px, py] = project(x, y, z + easeOut(p) * 1.4);
  const scale = p < 0.15 ? 0.6 + (p / 0.15) * 0.5 : 1.1 - Math.min(0.1, (p - 0.15) * 0.4);
  const opacity = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1;
  return (
    <g transform={`translate(${px} ${py}) scale(${scale})`} opacity={opacity}>
      <text className="iso-pop" textAnchor="middle" x={3} y={3} fill="#16183a">
        {text}
      </text>
      <text className="iso-pop" textAnchor="middle" fill={tone === 'xp' ? '#ffc83d' : '#8fe3a6'}>
        {text}
      </text>
    </g>
  );
};

export const WorldScene = ({ s, parallax = [0, 0] }: { s: WorldState; parallax?: readonly [number, number] }) => {
  const kubeBob = Math.floor(s.t * 2) % 2 === 0 ? 0 : 0.12;
  const actors = [
    { key: 'a', depth: s.a.x + s.a.y, el: <Player x={s.a.x} y={s.a.y} hop={s.a.hop} handle={HANDLES.you} /> , alpha: s.a.alpha },
    { key: 'b', depth: s.b.x + s.b.y, el: <Player x={s.b.x} y={s.b.y} hop={s.b.hop} handle={HANDLES.match} />, alpha: s.b.alpha },
    { key: 'n1', depth: 21, el: <Player x={13.6} y={7.6} handle="kelpie" />, alpha: 1 },
    { key: 'n2', depth: 22.5, el: <Player x={13.3} y={10.1} hop={Math.floor(s.t * 1.5) % 2 ? 0.06 : 0} handle="byte-otter" />, alpha: 1 },
    { key: 'n3', depth: 16, el: <Player x={5.3} y={10.4} handle="tinfoil-hat" />, alpha: 1 },
    { key: 'fire', depth: FIRE.x + FIRE.y + 1, el: <Fire t={s.t} flare={s.flare} />, alpha: 1 },
  ].sort((m, n) => m.depth - n.depth);

  return (
    <svg
      className="world"
      viewBox="-360 -190 720 560"
      role="img"
      aria-label="A block-built conference: the Salt Palace and the Hyatt Regency joined by a skybridge. A player scans a room's QR block, earns XP, then meets another player at a campfire."
    >
      <IsoDefs />
      <g transform={`translate(${-40 + parallax[0]} ${parallax[1]})`}>
        <StaticWorld />
        <BlockView b={{ x: 3.6, y: 1.6, z: 3.5 + kubeBob, w: 1.6, d: 1.6, h: 1.6, m: 'kube' }} outline={0.6} />
        <BlockView b={{ x: QR_A.x, y: QR_A.y, z: 0, w: 0.6, d: 0.16, h: 0.95, m: 'qr', top: 'iron' }} glow={s.scanGlow} outline={0.8} />
        <BlockView b={{ x: 11.2, y: 4.05, z: 0, w: 0.6, d: 0.16, h: 0.95, m: 'qr', top: 'iron' }} outline={0.8} />
        {s.ring > 0 && <Ring p={s.ring} />}
        {actors.map((a) => (
          <g key={a.key} opacity={a.alpha}>
            {a.el}
          </g>
        ))}
        {s.fly && (
          <BlockView
            b={{ x: s.fly.x + (1 - s.fly.s) / 2, y: s.fly.y + (1 - s.fly.s) / 2, z: s.fly.z, w: 0.6 * s.fly.s, d: 0.6 * s.fly.s, h: 0.6 * s.fly.s, m: s.fly.m }}
            outline={0.8}
          />
        )}
        {s.pops.map((p) => (
          <PopText key={p.key} text={p.text} x={p.x} y={p.y} z={p.z} p={p.p} tone={p.tone} />
        ))}
      </g>
    </svg>
  );
};
