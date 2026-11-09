import { Hotbar, PlayerCard, Toasts } from '../components/Hud';
import { worldState } from './timeline';
import { Sky, WorldScene } from './WorldScene';

export const HeroFrame = ({ t, width = 1920, height = 1080 }: { t: number; width?: number; height?: number }) => {
  const s = worldState(t);
  return (
    <div className="hero-frame" style={{ width, height }}>
      <Sky t={t} />
      <div className="hero-frame__world">
        <WorldScene s={s} />
      </div>
      <div className="hud hero-frame__hud">
        <Toasts s={s} />
        <div className="hud__right">
          <PlayerCard s={s} />
          <Hotbar s={s} />
        </div>
      </div>
    </div>
  );
};
