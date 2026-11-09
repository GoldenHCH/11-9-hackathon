# KubeQuest landing page

The marketing page for KubeQuest: a block-built KubeCon where players check in, prove they listened, meet at campfires and level up. React 18 + Vite + TypeScript, no UI library. Every block is SVG drawn by a tiny isometric engine, so it stays crisp at any size and renders the same in a browser and in Remotion.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5180
npm run build    # dist/ with index.html and frame.html
```

## Layout

| Path | What it is |
|------|------------|
| `src/engine/iso.ts` | Isometric projection, `Block` type, `box()` builder, depth sort |
| `src/engine/materials.ts` | 8×8 pixel textures for every material, and the track → material map from the game design |
| `src/engine/time.ts` | Easing, `useClock`, `useSpring`, reduced-motion and in-view hooks |
| `src/components/Iso.tsx` | `IsoDefs` (texture patterns), `BlockView`, `PixelFace` (8×8 face from a handle), `Player` |
| `src/scenes/timeline.ts` | The hero's 16 s story as a pure function `worldState(t)`: walk in, scan, +10 XP, quiz, meet quest, campfire handshake, +50 XP, gem, level up |
| `src/scenes/WorldScene.tsx` | The Salt Palace, Hyatt Regency, skybridge, campfire and players, drawn from `worldState(t)`; `Sky` / `SkyLayer` backdrop |
| `src/scenes/HeroFrame.tsx` | A 1920×1080 composition of sky, world and HUD for video |
| `src/sections/` | Hero and the page sections (a day both ways, how it plays, track blocks, Hallway, levels, traceable XP, accessibility) |
| `src/content.ts` | All page copy and sample data |

## Motion rules

- Every scene is a pure function of time. `worldState(t)` and `HeroFrame({ t })` hold no state, so any `t` gives the same frame.
- One orchestrated moment: the hero loop. Everything else moves only when someone acts (the level picker drops blocks in with a spring).
- Motion is stepped, not smooth, where it reads as "blocky": walking hops, fire frames, the scan flash and toast entrances are quantized.
- `prefers-reduced-motion` freezes the hero on the handshake beat (t = 10.9 s), and the hero has a Pause button.
- The loop only runs while the hero is on screen.

## Making the Remotion video

The scenes have no browser-only dependencies, so a Remotion project can import them directly:

```tsx
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { HeroFrame } from '../frontend/src/scenes/HeroFrame';
import '../frontend/src/styles.css';

export const KubeQuestHero = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return <HeroFrame t={frame / fps} />;
};
```

Register it as a 1920×1080 composition at 30 fps with `durationInFrames={16 * 30}` for one loop (`LOOP` in `timeline.ts`). Beat times are in `BEATS` there, which makes it easy to cut to captions on the scan (2.6 s), the check-in (3.0 s), the handshake (10.1 s) and the level up (11.8 s).

To preview without Remotion:

- `http://localhost:5180/frame.html` plays the 1080p frame; `frame.html?t=10.5` freezes it at 10.5 s.
- `http://localhost:5180/?t=3.4` freezes the landing page hero at any moment, for stills.

## Design notes

- Palette: night `#1a1c45`, ink `#16183a`, salt `#e9eef2`, Kubernetes blue `#326ce5`, XP gold `#ffc83d`, ember `#ff6b3d`, moss `#4cb36b`.
- Type: Silkscreen for headings, XP and buttons; Atkinson Hyperlegible for everything you read. "Turn off the pixel font" swaps headings to Atkinson and is remembered.
- 8 px grid, square corners, 3 px ink borders, hard 4 px and 8 px shadows. No gradients.
- The voxel look is our own. Nothing is taken from Minecraft (see `knowledge-graph/game-design.md`).
- Handles and faces on the page are made up.
