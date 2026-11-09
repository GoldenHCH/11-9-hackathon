import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HeroFrame } from './scenes/HeroFrame';
import { useClock } from './engine/time';
import './styles.css';

const FramePreview = () => {
  const fixed = new URLSearchParams(window.location.search).get('t');
  const t = useClock(fixed === null, Number(fixed ?? 0));
  return <HeroFrame t={t} />;
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FramePreview />
  </StrictMode>,
);
