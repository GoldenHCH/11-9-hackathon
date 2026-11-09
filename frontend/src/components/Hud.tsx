import { BlockView, IsoDefs, PixelFace } from './Iso';
import type { Material } from '../engine/iso';
import { HANDLES, LEVELS, type WorldState } from '../scenes/timeline';

export const MiniBlock = ({ m, size = 40, label }: { m: Material; size?: number; label?: string }) => (
  <svg width={size} height={size} viewBox="-26 -30 52 56" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
    <IsoDefs />
    <BlockView b={{ x: 0, y: 0, z: 0, m }} s={22} outline={0.8} />
  </svg>
);

export const PlayerCard = ({ s }: { s: WorldState }) => (
  <div className="hud-card" aria-hidden="true">
    <PixelFace handle={HANDLES.you} size={44} />
    <div className="hud-card__body">
      <div className="hud-card__row">
        <span className="pixel">@{HANDLES.you}</span>
        <span className="pixel hud-xp">{s.xp} XP</span>
      </div>
      <div className="hud-bar">
        <div className="hud-bar__fill" style={{ width: `${Math.max(0, Math.min(1, s.bar)) * 100}%` }} />
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="hud-bar__tick" style={{ left: `${(i + 1) * 10}%` }} />
        ))}
      </div>
      <div className="hud-card__level">
        Level {s.level + 1}: <strong>{LEVELS[s.level]}</strong>
      </div>
    </div>
  </div>
);

export const Hotbar = ({ s }: { s: WorldState }) => (
  <div className="hotbar" aria-hidden="true">
    {Array.from({ length: 6 }, (_, i) => {
      const m = s.inventory[i];
      const fresh = i === s.inventory.length - 1 && s.newSlot < 1 && i >= 2;
      return (
        <div key={i} className={`hotbar__slot${fresh ? ' is-fresh' : ''}`} style={fresh ? { transform: `scale(${0.6 + s.newSlot * 0.4})` } : undefined}>
          {m && <MiniBlock m={m} size={34} />}
        </div>
      );
    })}
  </div>
);

export const Toasts = ({ s }: { s: WorldState }) => (
  <div className="toasts" aria-hidden="true">
    {s.toasts.map((t) => (
      <div
        key={t.key}
        className="toast"
        style={{
          opacity: Math.min(t.p, 1 - t.out),
          transform: `translateY(${Math.round((1 - t.p) * 4) * 4}px)`,
        }}
      >
        <div className="toast__title pixel">{t.title}</div>
        <div className="toast__body">{t.body}</div>
      </div>
    ))}
  </div>
);
