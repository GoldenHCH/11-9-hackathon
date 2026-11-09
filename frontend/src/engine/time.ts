import { useEffect, useRef, useState } from 'react';

export const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export const span = (t: number, start: number, end: number) => clamp((t - start) / (end - start));

export const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);

export const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export const backOut = (p: number) => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2);
};

export const stepped = (p: number, steps: number) => Math.round(p * steps) / steps;

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

export const along = (points: readonly (readonly [number, number])[], p: number): [number, number] => {
  const lengths = points.slice(1).map((pt, i) => Math.hypot(pt[0] - points[i][0], pt[1] - points[i][1]));
  const total = lengths.reduce((s, l) => s + l, 0);
  let d = clamp(p) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (d <= lengths[i] || i === lengths.length - 1) {
      const q = lengths[i] === 0 ? 1 : d / lengths[i];
      return [lerp(points[i][0], points[i + 1][0], q), lerp(points[i][1], points[i + 1][1], q)];
    }
    d -= lengths[i];
  }
  return [points[0][0], points[0][1]];
};

export const usePrefersReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(q.matches);
    const on = (e: MediaQueryListEvent) => setReduced(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return reduced;
};

export const useClock = (running: boolean, still: number) => {
  const [t, setT] = useState(still);
  const origin = useRef<number | null>(null);
  useEffect(() => {
    if (!running) {
      setT(still);
      origin.current = null;
      return;
    }
    let id = 0;
    const tick = (now: number) => {
      if (origin.current === null) origin.current = now;
      setT((now - origin.current) / 1000);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [running, still]);
  return t;
};

export const useInView = <T extends Element>(threshold = 0.15) => {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold });
    io.observe(node);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, inView] as const;
};

export const useSpring = (target: number, stiffness = 170, damping = 18) => {
  const [value, setValue] = useState(target);
  const state = useRef({ x: target, v: 0 });
  useEffect(() => {
    let id = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      const s = state.current;
      const a = stiffness * (target - s.x) - damping * s.v;
      s.v += a * dt;
      s.x += s.v * dt;
      if (Math.abs(target - s.x) < 0.001 && Math.abs(s.v) < 0.001) {
        s.x = target;
        s.v = 0;
        setValue(target);
        return;
      }
      setValue(s.x);
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, stiffness, damping]);
  return value;
};
