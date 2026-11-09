# Phase 05 — Role views (attendee, exhibitor, organizer) and a page for every booth

**Goal:** three views, each with the information that person needs, and a page for every exhibitor on the KubeCon NA 2026 Solutions Showcase floor and in the Project Pavilion.
**Why:** the brief says "sponsors want booth traffic, and organizers can't see engagement". Today only 7 booths are playable and the organizer view is a placeholder.
**Branch:** `feat/role-views-booths`. **Rules to load:** `rules/hackathon.md`, `rules/typescript.md`, `rules/angular.md`, `rules/ui.md`, `rules/scss.md`.

## The three views

| View | Who | Entry | Gate | What it shows |
|---|---|---|---|---|
| Attendee | Players | `/map` and the bottom tabs (Here, Map, Quests, **Booths**, Board) | personal link (`attendeeId`) | Booth directory `/exhibitors` (search, tier/zone/topic/type filters, "N here now", "Visited") and a page per booth `/exhibitors/:outpostId` |
| Exhibitor | Booth staff | `/exhibitor` (saved booths, paste a staff link), `/exhibitor/:outpostId?k=<key>` | exhibitor key (HMAC of the outpost id), or the admin key | The booth's check-in QR to print or show, visits now/today/conference, unique and first-timer visitors, visits by hour, visitor topics and levels (aggregates only), recent visitors and who's here now (public cards only), booth-quest funnel, rank among booths |
| Organizer | Organizers | `/admin?k=<key>` (`/organizer` redirects here) | admin key | Event KPIs (`organizer_stats`), XP by type, meet and quest funnels, busiest rooms, live bosses; booth totals, by tier and zone, top and quiet booths, the full booth table with staff links and QR links |

A "View" menu in the header switches between the three. Staff views hide the attendee bottom tabs.

## Data

- `resources/locations.json` gets every exhibitor as an `outpost`: 233 sponsors with a booth number (`resources/venue/sponsors.json`, Anthropic and Northflank have no booth) and 86 Project Pavilion projects (`resources/venue/project_pavilion_kiosks.json`). The 7 hand-written booths keep their ids, `askAbout` and topics.
- New optional `ILocation` fields: `exhibitorType` (`sponsor` | `project`), `categories`, `hall`, `mapPosition` ({x, y} on the expo-hall PDF, the same coordinates as `web/public/venue/schematic.json`), `schedule` (project kiosk hours).
- Topics come from the sponsor directory categories by rule (AI → `ai`, Platform Engineering / CI/CD / App Dev → `platform`, Observability → `operations`, Security → `security`, Storage + Databases → `data`, Networking / Service Mesh / Edge → `connectivity`). Projects get topics from a small project → track table.
- `world` leaves outposts out (300+ booths would bury the rooms); booths live in `list_exhibitors`.

## Access keys

`signAccessKey(scope)` = `k.` + HMAC-SHA256 of `k:<scope>` with `QR_SECRET`, scope `admin` or `exhibitor:<outpostId>`. `exhibitor_dashboard` accepts the booth's key or the admin key; `admin_overview` only the admin key. A wrong key is `403 bad_key`. Keys never go into span attributes or logs. `npm run access-links` prints the admin link and every staff link.

## Tools (all in `app/src/tools/`, each emits a span, no model inside)

- `list_exhibitors` `{query?, type?, tier?, zone?, topic?, attendeeId?, limit? (default 60, max 400), offset?}` → `IExhibitorDirectory`. With `query`: hybrid (semantic `searchText` + BM25 on name, askAbout, categories). Without: attendee topic overlap first when `attendeeId` is given, then tier order, then booth number. Facets are terms aggregations over the filtered set. `visitorsNow` = distinct players with a check-in there in the last 20 minutes; `visitedByMe` when `attendeeId` is given.
- `get_exhibitor` `{outpostId, attendeeId?}` → `IExhibitorPage`: the booth, live counts, talks whose speakers work there (speaker `company` matches the exhibitor name), up to 6 players here now (public cards, meeting on, not hidden), 4 nearest booths by `geo_distance`, and for the caller whether they visited and their booth quest. `404 unknown_outpost`.
- `exhibitor_dashboard` `{outpostId, key}` → `IExhibitorDashboard`.
- `admin_overview` `{key, since?}` → `IAdminOverview`.

Fixtures: `resources/fixtures/{list_exhibitors,get_exhibitor,exhibitor_dashboard,admin_overview}.json` as `{request, status, response, variants}`. `docs/api.md` documents all four.

## Checklist

- [ ] Contract: backend types (`app/src/types/`) and web mirror (`web/src/app/core/interfaces/exhibitor.interfaces.ts`)
- [ ] Shell: routes, View menu, Booths tab, `AccessKeyService`, `ToolsService` fixture unwrap, `environment.development.ts` (fixtures) vs `environment.ts` (live)
- [ ] Data: all exhibitors in `locations.json`, mappings, `world` without outposts, seeded booth visits
- [ ] Tools + access keys + fixtures + `docs/api.md` + `npm run access-links`
- [ ] Attendee: booth directory and booth page
- [ ] Exhibitor: home and dashboard with the QR
- [ ] Organizer: admin dashboard
- [ ] Typecheck, lint, web build; walk every screen at 375 px on fixtures
- [ ] After merge: re-run the index Job so the cluster's `locations` index has every booth; check `/exhibitors` live

## Done when

On the live URL: `/exhibitors` lists 319 booths, a booth page shows live counts and its talks, a staff link opens that booth's dashboard with its QR, scanning that QR moves the dashboard's "now" count, and the admin link shows the booth table.
