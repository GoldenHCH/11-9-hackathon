# KubeQuest web

Angular 21 (standalone, Material, SCSS) front end for KubeQuest. The Express API in `app/` serves the production build.

## Run it

```bash
cd web
npm install
npm start            # http://localhost:4200, proxies /api to http://localhost:8080
npm run build        # production build into web/dist/web/browser
```

`src/environments/environment.ts` has `useFixtures`. While it's `true`, `ToolsService.call()` reads `public/fixtures/<tool>.json` after a 300 ms delay instead of calling `POST /api/tools/:name`.

## Venue map

`/map` shows the KubeCon + CloudNativeCon NA 2026 venue as a block schematic:

- **Showcase floor:** every sponsor booth at its position on the official Solutions Showcase map, coloured by tier, with halls, zones, theaters, the Project Pavilion and the Network Nook.
- **Salt Palace Levels 1–3 and Hyatt Regency Lobby–Level 5:** session rooms, campfires (meeting points), registration, sponsor meeting rooms and the walk between buildings. These are laid out by hand from the official venue map's labels, not drawn to scale; areas with a dashed outline have estimated positions.
- **Find a booth:** search by company, project, booth number, zone or topic, then jump to it on the map.
- **List view:** the same rooms as a plain list, for screen readers and keyboard users.

The data is `public/venue/schematic.json`, generated from `resources/venue/` (the official sponsor directory, Solutions Showcase map and Project Pavilion sheet, plus `resources/venue/SOURCES.md` for what is confirmed and what is inferred):

```bash
node scripts/build-venue-schematic.mjs
```

Each room lists the exact schedule strings it hosts (`scheduleRooms`, for example `Hyatt Regency | Level 4 | Regency Ballroom B-D`), so sessions from the Sessionize feed can be joined to a room on the map.
