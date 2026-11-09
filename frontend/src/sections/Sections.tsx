import { useEffect, useMemo, useState } from 'react';
import { IsoFigure } from '../components/IsoFigure';
import { MiniBlock } from '../components/Hud';
import { PixelFace } from '../components/Iso';
import { ACCESS, BOARD, DAY_WITH, DAY_WITHOUT, LEVEL_INFO, LOOP_STEPS, TRACE } from '../content';
import type { Block, Material } from '../engine/iso';
import { TRACKS } from '../engine/materials';
import { backOut, span, usePrefersReducedMotion } from '../engine/time';

export const Day = () => (
  <section className="section section--salt" id="day" aria-labelledby="day-title">
    <div className="wrap">
      <h2 id="day-title" className="section__title pixel">
        Same conference, different day
      </h2>
      <p className="section__lede">
        KubeCon has around 600 sessions and 10,000 people. Without a reason to move, most of them stay in their bubble.
        Here is one Tuesday, played both ways.
      </p>
      <div className="day">
        <div className="day__col day__col--before">
          <div className="day__head">
            <PixelFace handle="nobody-in-particular" size={40} label="A player without KubeQuest" />
            <h3>Without KubeQuest</h3>
          </div>
          <ol className="day__list">
            {DAY_WITHOUT.map((e) => (
              <li key={e.time}>
                <time>{e.time}</time>
                <span>{e.text}</span>
              </li>
            ))}
          </ol>
          <p className="day__tally">End of day: nothing in your pockets, nobody new in your phone.</p>
        </div>
        <div className="day__col day__col--after">
          <div className="day__head">
            <PixelFace handle="you" size={40} label="Your pixel face" />
            <h3>With KubeQuest</h3>
          </div>
          <ol className="day__list">
            {DAY_WITH.map((e) => (
              <li key={e.time}>
                <time>{e.time}</time>
                <span>{e.text}</span>
                <span className="day__gain">
                  {e.m && <MiniBlock m={e.m} size={28} />}
                  <span className="pixel">{e.xp}</span>
                </span>
              </li>
            ))}
          </ol>
          <p className="day__tally">
            End of day: 100 XP, two blocks, a gem, and one new person who is fixing the same bug you are.
          </p>
        </div>
      </div>
    </div>
  </section>
);

const stair = (i: number, m: Material): Block[] =>
  Array.from({ length: i + 1 }, (_, k) => ({ x: 0, y: 0, z: k, m: k === i ? m : 'wall', top: k === i ? m : 'roof' }));

export const Loop = () => (
  <section className="section section--paper" id="loop" aria-labelledby="loop-title">
    <div className="wrap">
      <h2 id="loop-title" className="section__title pixel">
        How a day plays
      </h2>
      <p className="section__lede">Five steps, and the middle three repeat until the closing keynote.</p>
      <ol className="stairs">
        {LOOP_STEPS.map((step, i) => (
          <li key={step.title} className="stairs__step">
            <IsoFigure className="stairs__fig" blocks={stair(i, step.m)} frame={stair(4, step.m)} s={22} />
            <h3>
              <span className="stairs__n pixel">{i + 1}</span> {step.title}
            </h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export const Tracks = () => (
  <section className="section section--salt" id="tracks" aria-labelledby="tracks-title">
    <div className="wrap">
      <h2 id="tracks-title" className="section__title pixel">
        Every track drops its own block
      </h2>
      <p className="section__lede">
        Check in to a talk and you collect a block in that track’s material. Each one has its own pattern, so you can
        tell them apart without color.
      </p>
      <ul className="tracks">
        {TRACKS.map((t) => (
          <li key={t.m} className="tracks__item">
            <IsoFigure className="tracks__fig" blocks={[{ x: 0, y: 0, z: 0, m: t.m }]} s={44} />
            <div>
              <div className="tracks__name pixel">{t.short}</div>
              <div className="tracks__track">{t.track}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export const Hallway = () => (
  <section className="section section--night" id="hallway" aria-labelledby="hallway-title">
    <div className="wrap hallway">
      <div className="hallway__copy">
        <h2 id="hallway-title" className="section__title pixel">
          Meetings that actually happen
        </h2>
        <p className="section__lede">
          Knowing who to meet is the easy part. Hallway also finds a time you are both free, a campfire between you, and
          the first thing to say.
        </p>
        <ul className="rules">
          <li>
            <strong>Both say yes first.</strong> Tap “Let’s meet”. They see nothing about it until they tap it too.
          </li>
          <li>
            <strong>A real place nearby.</strong> Campfires are the venue’s own meeting spots, like the Community Hub, so
            you can find them on the signs.
          </li>
          <li>
            <strong>Proof you met.</strong> You both scan the campfire’s code within 30 minutes. That’s a verified
            handshake.
          </li>
        </ul>
      </div>
      <article className="intro-card" aria-label="Example of a Hallway meet card">
        <div className="intro-card__faces">
          <figure>
            <PixelFace handle="you" size={72} label="Your pixel face" />
            <figcaption>@you</figcaption>
          </figure>
          <span className="intro-card__link pixel" aria-hidden="true">
            +
          </span>
          <figure>
            <PixelFace handle="quietgopher" size={72} label="Pixel face of quietgopher" />
            <figcaption>@quietgopher</figcaption>
          </figure>
        </div>
        <p className="intro-card__why">Both of you are chasing slow Argo CD syncs on large monorepos.</p>
        <dl className="intro-card__meta">
          <div>
            <dt>Campfire</dt>
            <dd>Community Hub, Salt Palace, Level 1</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>3:30 to 3:45, your first shared gap</dd>
          </div>
        </dl>
        <blockquote className="intro-card__ice">“Ask what finally cut their sync time in half.”</blockquote>
        <div className="intro-card__arrivals">
          <span className="chip chip--done">You’re here ✓</span>
          <span className="chip chip--done">They’re here ✓</span>
        </div>
        <div className="intro-card__reward">
          <MiniBlock m="gem" size={36} />
          <span className="pixel">+50 XP each and a gem</span>
        </div>
      </article>
    </div>
  </section>
);

const ORDER: [number, number, number][] = [];
for (let z = 0; z < 3; z++)
  for (const [x, y] of [
    [1, 1],
    [0, 0],
    [2, 2],
    [0, 2],
    [2, 0],
    [1, 0],
    [0, 1],
    [2, 1],
    [1, 2],
  ])
    ORDER.push([x, y, z]);
const LEVEL_COUNTS = [1, 4, 9, 18, 27];
const STACK_MATS: Material[] = ['stone', 'circuit', 'glass', 'crate', 'iron', 'copper', 'lantern', 'wood', 'gem'];
const FULL: Block[] = ORDER.map(([x, y, z], i) => ({ x, y, z, m: STACK_MATS[i % STACK_MATS.length], key: `s${i}` }));

const useSince = (key: number, duration: number, enabled: boolean) => {
  const [dt, setDt] = useState(duration);
  useEffect(() => {
    if (!enabled) {
      setDt(duration);
      return;
    }
    let id = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const v = (now - start) / 1000;
      setDt(v);
      if (v < duration) id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [key, duration, enabled]);
  return dt;
};

export const Levels = () => {
  const reduced = usePrefersReducedMotion();
  const [level, setLevel] = useState(2);
  const [prev, setPrev] = useState(2);
  const dt = useSince(level, 1.6, !reduced);
  const count = LEVEL_COUNTS[level];
  const prevCount = LEVEL_COUNTS[prev];

  const { blocks, lifts } = useMemo(() => {
    const shown = FULL.slice(0, count).map((b, i) =>
      level === 4 && i === 18 ? { ...b, m: 'kube' as Material } : b,
    );
    const lifts: Record<string, number> = {};
    shown.forEach((b, i) => {
      if (i >= prevCount) {
        const delay = (i - prevCount) * 0.05;
        lifts[b.key!] = (1 - backOut(span(dt, delay, delay + 0.4))) * 3;
      }
    });
    return { blocks: shown, lifts };
  }, [count, prevCount, dt, level]);

  return (
    <section className="section section--paper" id="levels" aria-labelledby="levels-title">
      <div className="wrap levels">
        <div>
          <h2 id="levels-title" className="section__title pixel">
            From Pod to Control Plane
          </h2>
          <p className="section__lede">Your blocks stack up as you play. Pick a level to see what it takes.</p>
          <div className="levels__picker" role="radiogroup" aria-label="Level">
            {LEVEL_INFO.map((l, i) => (
              <button
                key={l.name}
                type="button"
                role="radio"
                aria-checked={level === i}
                className={`levels__btn${level === i ? ' is-on' : ''}`}
                onClick={() => {
                  setPrev(i > level ? level : i);
                  setLevel(i);
                }}
              >
                <span className="pixel">{i + 1}</span> {l.name}
              </button>
            ))}
          </div>
          <p className="levels__text" aria-live="polite">
            <strong>{LEVEL_INFO[level].name}.</strong> {LEVEL_INFO[level].text}
          </p>
        </div>
        <IsoFigure
          className="levels__fig"
          blocks={blocks}
          frame={[{ x: 0, y: 0, z: 0, w: 3, d: 3, h: 4, m: 'salt' }]}
          lifts={lifts}
          s={44}
          label={`A stack of ${count} blocks for the ${LEVEL_INFO[level].name} level`}
        />
      </div>
    </section>
  );
};

export const Traceable = () => (
  <section className="section section--salt" id="trace" aria-labelledby="trace-title">
    <div className="wrap">
      <h2 id="trace-title" className="section__title pixel">
        Every point is traceable
      </h2>
      <p className="section__lede">
        Each XP award is a record in Elasticsearch and a trace in OpenTelemetry. Open any row on the board and follow the
        scan from the phone to the database.
      </p>
      <div className="trace">
        <ol className="board" aria-label="Example leaderboard">
          {BOARD.map((r, i) => (
            <li key={r.handle} className={`board__row${r.handle === 'you' ? ' is-you' : ''}`}>
              <span className="board__rank pixel">{i === 4 ? 23 : i + 1}</span>
              <PixelFace handle={r.handle} size={32} label="" />
              <span className="board__handle">@{r.handle}</span>
              <span className="board__banners">
                {r.banners.map((b) => (
                  <span key={b} className="chip">
                    {b}
                  </span>
                ))}
              </span>
              <span className="board__xp pixel">{r.xp}</span>
            </li>
          ))}
        </ol>
        <figure className="waterfall">
          <figcaption>
            <span className="pixel">+10 XP</span> for @you, check-in at Hall DE
          </figcaption>
          <ul>
            {TRACE.map((sp) => (
              <li key={sp.name} style={{ paddingLeft: `${sp.depth * 16}px` }}>
                <span className="waterfall__name">
                  {sp.name} <em>{sp.service}</em>
                </span>
                <span className="waterfall__track">
                  <span
                    className={`waterfall__bar waterfall__bar--${sp.service.replace(/[^a-z]/g, '')}`}
                    style={{ left: `${sp.start}%`, width: `${sp.dur}%` }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </figure>
      </div>
    </div>
  </section>
);

export const Access = ({ plain, onToggle }: { plain: boolean; onToggle: () => void }) => (
  <section className="section section--paper" id="access" aria-labelledby="access-title">
    <div className="wrap">
      <h2 id="access-title" className="section__title pixel">
        Built so everyone can play
      </h2>
      <p className="section__lede">
        The pixel font is for fun. Turn it off and every screen keeps its layout in a font made for legibility.
      </p>
      <button type="button" className="btn btn--ghost" aria-pressed={plain} onClick={onToggle}>
        {plain ? 'Turn the pixel font back on' : 'Turn off the pixel font'}
      </button>
      <ul className="access">
        {ACCESS.map((a) => (
          <li key={a.title}>
            <h3>{a.title}</h3>
            <p>{a.text}</p>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

export const Finale = () => (
  <section className="finale" aria-labelledby="finale-title">
    <div className="wrap finale__inner">
      <IsoFigure
        className="finale__fig"
        blocks={[
          { x: 0, y: 0, z: 0, w: 0.9, d: 0.25, h: 1.4, m: 'qr', top: 'iron' },
          { x: 0.2, y: 0.8, z: 0, w: 0.5, d: 0.5, h: 0.5, m: 'glass' },
        ]}
        s={64}
        pad={8}
      />
      <div>
        <h2 id="finale-title" className="section__title pixel">
          Find a QR block. Scan it.
        </h2>
        <p className="section__lede">Your first 10 XP is at the nearest room door.</p>
        <a className="btn" href="/onboarding">
          Start playing
        </a>
      </div>
    </div>
    <footer className="foot wrap">
      <p>
        Built at the WeMakeDevs Cloud Native Hackathon in Salt Lake City, November 9, 2026. Runs on Kubernetes, with
        Elasticsearch as its only data store.
      </p>
      <p>Handles and faces on this page are made up.</p>
    </footer>
  </section>
);
