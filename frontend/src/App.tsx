import { useEffect, useState } from 'react';
import { Hero } from './sections/Hero';
import { Access, Day, Finale, Hallway, Levels, Loop, Traceable, Tracks } from './sections/Sections';

const readPlain = () => {
  try {
    return localStorage.getItem('kq-plain') === '1';
  } catch {
    return false;
  }
};

export const App = () => {
  const [plain, setPlain] = useState(readPlain);
  useEffect(() => {
    document.body.classList.toggle('plain', plain);
    try {
      localStorage.setItem('kq-plain', plain ? '1' : '0');
    } catch {
      return;
    }
  }, [plain]);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Hero />
      <main id="main">
        <Day />
        <Loop />
        <Tracks />
        <Hallway />
        <Levels />
        <Traceable />
        <Access plain={plain} onToggle={() => setPlain((p) => !p)} />
      </main>
      <Finale />
    </>
  );
};
