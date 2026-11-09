import { useEffect, useRef, useState } from 'react';
import { Hotbar, PlayerCard, Toasts } from '../components/Hud';
import { useClock, useInView, usePrefersReducedMotion, useSpring } from '../engine/time';
import { worldState } from '../scenes/timeline';
import { Sky, WorldScene } from '../scenes/WorldScene';

const STILL_FRAME = 10.9;

const frozenAt = () => {
  const v = new URLSearchParams(window.location.search).get('t');
  return v === null || Number.isNaN(Number(v)) ? null : Number(v);
};

export const Hero = () => {
  const reduced = usePrefersReducedMotion();
  const [paused, setPaused] = useState(false);
  const [ref, inView] = useInView<HTMLElement>(0.05);
  const [frozen] = useState(frozenAt);
  const t = useClock(inView && !paused && !reduced && frozen === null, frozen ?? STILL_FRAME);
  const s = worldState(t);

  const [target, setTarget] = useState<[number, number]>([0, 0]);
  const px = useSpring(target[0], 60, 14);
  const py = useSpring(target[1], 60, 14);
  const stage = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = stage.current;
    if (!node || reduced) return;
    const move = (e: PointerEvent) => {
      const r = node.getBoundingClientRect();
      setTarget([((e.clientX - r.left) / r.width - 0.5) * -18, ((e.clientY - r.top) / r.height - 0.5) * -10]);
    };
    const leave = () => setTarget([0, 0]);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerleave', leave);
    return () => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerleave', leave);
    };
  }, [reduced]);

  return (
    <section className="hero" ref={ref} aria-labelledby="hero-title">
      <Sky t={t} shift={px} />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="KubeQuest home">
          <img src="/cube.svg" width={28} height={28} alt="" />
          <span className="pixel">KubeQuest</span>
        </a>
        <nav className="topnav" aria-label="Sections">
          <a href="#day">A day</a>
          <a href="#loop">How it plays</a>
          <a href="#plan">Plan your day</a>
          <a href="#hallway">Hallway</a>
          <a href="#levels">Levels</a>
        </nav>
        <a className="btn btn--small" href="/signup">
          Start playing
        </a>
      </header>

      <div className="hero__copy">
        <p className="hero__where">KubeCon North America 2026, Salt Lake City</p>
        <h1 id="hero-title" className="hero__title pixel">
          KubeCon is a game now.
        </h1>
        <p className="hero__lede">
          Scan a room to check in. Prove you listened with a three-question quiz. Meet the person working on your exact
          problem at a campfire. Every step earns XP.
        </p>
        <div className="hero__ctas">
          <a className="btn" href="/signup">
            Start playing
          </a>
          <a className="btn btn--ghost" href="#day">
            See a day played
          </a>
        </div>
      </div>

      <div className="hero__stage" ref={stage}>
        <WorldScene s={s} parallax={[px, py]} />
        <div className="hud">
          <Toasts s={s} />
          <div className="hud__right">
            <PlayerCard s={s} />
            <Hotbar s={s} />
          </div>
        </div>
        {!reduced && (
          <button className="pause" type="button" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
            {paused ? 'Play scene' : 'Pause scene'}
          </button>
        )}
      </div>
    </section>
  );
};
