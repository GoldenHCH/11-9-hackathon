# Phase 05 — Widen: the incident, Dash0 dashboard + SLO, assistant + MCP, nudges

> **Status (14:50 MST):** not started; nothing below has a branch. What changed since 14:10:
> - **Dependencies met:** the Dash0 keys and a first trace (items 1 and 2), and a working model through Agent Builder (item 3; PR 10, PR 14). The 403 fallback is no longer an incident candidate; the `index-all` bundle still is.
> - **Item 7:** `DEMO_NOW` stays unset, and the boss read `fighting`, 10/10, at 14:47. What's left is keeping rehearsals from draining it before 17:15.
> - **Phase 03 is the critical path** and its screens are placeholders on `main` (`phase-03-ui.md`). If Collin needs help, a demo-path screen comes before items 3 to 6 here.
> - PR 16 added two more phase files: the handshake work is `phase-06-handshake-booth-notes.md` (merged) and the role views are `phase-07-roles-booths.md` (in progress).
>
> **Status (14:10 MST):** not started. Written against `origin/main` at `5e290cb` (live as `ae5e756`), `docs/api.md` and the open PRs. PR 5 already shipped part of the old Phase 05 row; see "Already shipped" below.

**Goal:** the demo's tooling story is real (an incident found with Radar and Agent0 and fixed through a Gitar-reviewed PR and Argo CD, a Dash0 dashboard with an SLO), and then, in cut order, the extras that widen the game.
**Brief requirements covered:** Dash0 ("Agent0 or the MCP server to find and fix something real during the day, shown in the demo"; bonus dashboard or SLO); Radar ("AI investigations on a real issue"); Sonar ("features landing through PRs it reviewed"); Elastic (Agent Builder, `geo_distance` for "near you").
**Depends on:** Dash0 keys in `app-credentials` and a first trace (Collin, `phase-04-ops.md`) for items 1 and 2; a working model on the live app (`phase-02-tools.md`, item 2 of its status note) for item 3; the `DEMO_NOW` decision for item 7.
**Owners:** split per item. **Budget:** 15:30–16:30. Golden's boxes add up to more than the hour on purpose: do them top to bottom and stop at 16:30.
**Rules to load:** `rules/hackathon.md`, `rules/typescript.md`, `rules/ai.md` (item 3), `rules/git.md`.

## Already shipped (don't rebuild)

- [x] Organizer stats: the `organizer_stats` tool (PR 5). Its screen is Phase 03, section 7
- [x] Quests: `quest_board`, `respond_quest`, `make_quest` with attend, quiz, chat, outpost, boss and collection quests (PR 5)
- [x] `inventory` (blocks, gems, banners, level) and `world` (buildings, levels, rooms, busyness) (PR 5)
- [x] Three leaderboards with `today` and `conference` (PR 5)
- [x] Agent-written quizzes for 25 talks, committed in `resources/sessions.json` (PR 10)
- [x] From the game design's "Build today" column: the world (39 locations in `resources/locations.json`: 22 rooms, 6 campfires, 7 outposts, 2 theaters, 2 boss rooms, including the hackathon venue) and the theme in the Angular shell (pixel font variable, square corners, hard shadows in `web/src/styles.scss`)

## Checklist

One PR per item. Items 1 to 6 are in build order; 7 and 8 are "Build today" items from `knowledge-graph/game-design.md` that no other plan covers.

### 1. The incident (30 min, 15:30–16:00) — Golden (Radar, fix PR), Collin (Agent0) · Cut: never

A real one, in this order: Radar AI investigation → Agent0 → Gitar-reviewed fix PR → Argo CD.

- [ ] Pick the symptom at 15:30 from what is actually broken then. Two candidates exist now: the image's `index-all` bundle exits 0 and indexes nothing (`docs/radar-log.md`, section 4; both bugs are still in `scripts/seed.ts` on `main`), and the model calls falling back after a 403 from Agent Builder (PR 10's body; not re-checked on the live app)
- [ ] The person starts Radar's hosted AI investigation on the affected workload (the sparkle button, or asks the agent to). Screenshot it; log what it found in `docs/radar-log.md`
- [ ] Agent0 (or the Dash0 MCP) on the same symptom: the trace or log line that points at the code. Screenshot. Blocked until Dash0 has a trace; if there is none by 15:45, do the Radar half and the fix, and add Agent0 when the trace exists
- [ ] Fix PR that references both findings; Gitar reviews it; merge
- [ ] After the `deploy: <sha>` commit, confirm through Radar that Argo CD synced that revision, the workload is healthy and the URL shows the new version. One line in `docs/radar-log.md`
- [ ] If nothing real is broken at 15:30: a rollout with a too-tight memory limit, declared as staged in the demo (`00-general.md`, "Cut on purpose")
- **Done when:** `docs/radar-log.md` has the incident with both screenshots, the fix PR is merged with a Gitar review, and `/healthz` reports the fix's SHA.

### 2. Dash0 dashboard + SLO (20 min) — Collin · Cut: last (6th)

- [ ] Blocked until the Dash0 keys are in `app-credentials` and a trace is confirmed
- [ ] Dashboard from the metrics that exist (`app/src/observability/metrics.ts`): check-ins by location (`kubequest.checkins`), XP by type (`kubequest.xp.awarded`), meets verified (`kubequest.handshakes`), quiz duration (`kubequest.quiz.duration`)
- [ ] One SLO on `check_in`. The brief says p95 < 500 ms, but `docs/api.md` measured `check_in` at 0.9 to 2.8 s, so set the threshold from what Dash0 shows or it is red in the demo
- [ ] Set `DASH0_TRACE_URL_TEMPLATE` so `/api/config` returns `traceUrlTemplate` and the board's "Open trace" works (it is absent on the live app as of 14:10)
- [ ] Dashboard and SLO links in `docs/ops.md`; one screenshot for the README
- **Done when:** the dashboard shows a check-in made on the live URL within a minute, and the SLO has a status.

### 3. Assistant + MCP over the tools (30 min) — Golden · Cut: 4th (the assistant first, then MCP)

**Blocked** until the model works on the live app. Neither exists yet: there is no assistant or MCP code under `app/src/`.

- [ ] MCP server with the MCP TypeScript SDK, registering every tool from `app/src/tools/index.ts` with the same names and input schemas that `GET /api/tools` lists. It calls the tools module and nothing else
- [ ] Assistant: one input box; the model picks a tool and arguments, the server runs the tool, the reply is the tool's output in a sentence. The model call lives in `app/src/ai/`, never in `app/src/tools/`; `attendeeId` comes from the session, never from the model
- [ ] The assistant must not return another player's private fields: it only ever sees tool output, which already carries `pl_…` ids
- [ ] If the model is still down at this item's turn, ship the MCP server alone (it calls no model) and cut the assistant
- **Done when:** Claude Code, connected to the MCP server, runs `leaderboard` and `whats_around_me`; and (assistant) "what should I do next?" answers from `whats_next` or `quest_board` on the live URL.

### 4. Nudge CronJob (25 min) — Golden · Cut: 3rd

Not built: there is no CronJob in `deploy/` and no nudge script or tool.

- [ ] One new tool, no model: for each player with an accepted meet whose partner has already scanned the campfire, or an accepted attend quest starting within 10 minutes, write one nudge line. Decide the smallest store first (the brief calls it an in-app feed); it needs an entry in `docs/api.md` and a fixture
- [ ] `deploy/cronjob-nudge.yaml` in `deploy/kustomization.yaml`: every 5 minutes, the app image, calls the tool over HTTP. Set requests and limits so it fits the team quota
- [ ] The run emits a span like every other tool call
- [ ] Confirm the first run in Radar (`manage_cronjob` to run it now); one line in `docs/radar-log.md`
- **Done when:** Radar shows the CronJob's last run succeeded, and a player with an accepted meet sees the nudge on the Now card.

### 5. Quests near you (15 min) — Golden · Cut: 2nd

Partly there: offers carry `walkMinutes` from the last scan and other-building offers can be dropped, but `outpostCandidates` in `app/src/quests/offers.ts` ranks outposts by topic only.

- [ ] Sort outpost and attend candidates by `_geo_distance` from the last check-in's `geo`, the way `app/src/match/around.ts` finds the nearest campfire; keep the topic match as the filter
- [ ] The offer's `reason` says how far ("2 minutes from here")
- [ ] Regenerate the `quest_board` fixture
- **Done when:** after a scan at an outpost, the first outpost offer on `quest_board` is the nearest unvisited one.

### 6. Crafting (0 min unless items 1 to 5 are done by 15:30) — nobody · Cut: 1st

- [ ] Roadmap slide. The game design marks crafting as roadmap, and the brief says "Roadmap unless everything above is green by 3:30". `inventory` already returns the blocks and gems it would spend
- **Done when:** the roadmap slide names Compass and Lantern.

### 7. The boss fight is on at demo time (10 min) — Golden · Cut: never

"Build today" in the game design: one boss whose health bar drops as judges answer. No plan checks that it is fightable at 17:15.

- [x] `resources/sessions.json` has `cnh-demo-boss-2026` at `cloud-native-hackathon`, 13:00 to 18:30 on Nov 9, so on the real clock the fight is open through the demo. Checked live at 14:47: `boss_state` for `{"locationId":"cloud-native-hackathon"}` reads `fighting`, health 10/10, deadline 18:45 MST
- [x] Decided at 14:50: leave the real clock, so `DEMO_NOW` stays unset. The reasoning: From reading `app/src/world/clock.ts` and `app/src/quests/boss.ts` (not run): `DEMO_NOW=2026-11-10T09:00:00-07:00` puts the world clock past the demo boss's deadline, and `boss_state` would read `escaped`. Either leave the real clock (the boss works; `whats_next` stays empty, as `docs/api.md` says) or move the demo boss into the `DEMO_NOW` window and reseed. One or the other, not both
- [ ] Rehearsal answers count as damage. Before the demo, make sure the bar is not already at zero: check `boss_state`, and if it is, decide the reset (delete the rehearsal's `boss` events for that talk, or seed a second demo boss)
- **Done when:** on the live URL at the chosen clock, `boss_state` for the demo room reads `waiting` or `fighting`, and one quiz submission from a checked-in player lowers `health`.

### 8. Phone location for "Near me" (15 min) — Collin · Cut: 5th

"Build today, if time allows" in the game design. The backend takes it (`geo` on `check_in` and `search`, the `nearMe` filter); no UI item asks the browser for it.

- [ ] Ask for the phone's location the first time the player taps "Near me" in Search, and only when `settings.locationOn`; never on page load
- [ ] Send `geo` with `search` and `check_in` while it is granted. Denied or off: everything works from the last scan, with no error shown
- **Done when:** on a phone, "Near me" in Search returns results with `distanceMeters`, and denying the prompt leaves Search working.

## Cut order

Crafting → quests near you → nudge CronJob → assistant, then MCP → phone location → Dash0 SLO, then the dashboard. **Never cut:** the incident, the boss fight on at demo time.

## Done when

- [ ] The incident is in `docs/radar-log.md` with the Radar investigation, the Agent0 finding and the merged fix PR, and the live URL runs the fix
- [ ] The Dash0 dashboard shows live check-ins and the SLO has a status
- [ ] `boss_state` for `cloud-native-hackathon` is fightable at the clock the demo will use
- [ ] Every item that shipped has a merged PR with a Gitar review; every item that was cut is on the roadmap slide
