import type { ReactNode } from 'react';
import { BlockView, IsoDefs } from './Iso';
import { byDepth, project, type Block } from '../engine/iso';

const bounds = (blocks: Block[], s: number, pad: number) => {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const b of blocks) {
    const w = b.w ?? 1,
      d = b.d ?? 1,
      h = b.h ?? 1;
    for (const [dx, dy, dz] of [
      [0, 0, h],
      [w, 0, h],
      [0, d, h],
      [w, d, 0],
      [w, 0, 0],
      [0, d, 0],
    ]) {
      const [px, py] = project(b.x + dx, b.y + dy, b.z + dz, s);
      x0 = Math.min(x0, px);
      y0 = Math.min(y0, py);
      x1 = Math.max(x1, px);
      y1 = Math.max(y1, py);
    }
  }
  return `${x0 - pad} ${y0 - pad} ${x1 - x0 + pad * 2} ${y1 - y0 + pad * 2}`;
};

export const IsoFigure = ({
  blocks,
  frame,
  s = 24,
  pad = 4,
  label,
  className,
  lifts,
  children,
}: {
  blocks: Block[];
  frame?: Block[];
  s?: number;
  pad?: number;
  label?: string;
  className?: string;
  lifts?: Record<string, number>;
  children?: ReactNode;
}) => (
  <svg
    className={className}
    viewBox={bounds(frame ?? blocks, s, pad)}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
  >
    <IsoDefs />
    {[...blocks].sort(byDepth).map((b, i) => (
      <BlockView key={b.key ?? `${b.x},${b.y},${b.z},${i}`} b={b} s={s} lift={lifts?.[b.key ?? ''] ?? 0} outline={0.7} />
    ))}
    {children}
  </svg>
);
