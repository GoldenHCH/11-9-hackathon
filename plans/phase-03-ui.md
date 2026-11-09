# Phase 03 — Angular UI against the live backend

> **Status (14:50 MST): the critical path.** Checked against `origin/main` (`69d5f47`, live as `0110194`). No Phase 03 branch or PR is on GitHub; Collin's local work was not checked.
> - **Placeholders on `main`, all on the demo path:** `/signup` (section 1), `/here` with the boss bar (section 2), `/quiz/:talkId` (section 3), `/quests` (section 4), `/board` and `/screen/:locationId` (section 5), `/organizer` (section 7). Sections 0–5 come before anything else.
> - **Already built by PR 16** (`phase-06-handshake-booth-notes.md`), don't rebuild: `/r/:locationId` (scan landing with the booth takeaways form, section 1's scan half), `/meets` and `/intro/:id` (section 4's meet half; keep the `intro/:id` route name instead of renaming it to `meet/:meetId`), `/me/:attendeeId` (the personal link signs you in), plus `/code`, `/handshake/:id`, `/notes`, `/recap`. `MeGuard`, `ApiErrorHelper` and `PixelFaceComponent` exist in `web/src/app/core/` and `shared/`; `ConfigService` and a polling helper don't yet.
> - **Section 4 changed:** a meet completes by handshake (`/code` → scan → shared question), not by two campfire scans. The meet card links to `/code` once accepted; the campfire is only the suggested place.
> - **Section 7 moves:** the organizer screen is Phase 07's `/admin` (`phase-07-roles-booths.md`, Golden). Skip it here.
> - **`whats_next` and `recommend_talks` stay empty live:** `DEMO_NOW` stays unset so the demo boss is fightable. Build the itinerary on fixtures, or drop it from the demo.
> - **Tool count:** the contract is now 32 tools (PR 16 added 9).

**Goal:** every screen on the demo path works on a phone at 375 px against the tools in `docs/api.md`, first from `resources/fixtures/`, then live, and the whole loop runs keyboard-only. The demo screen shows a live QR that judges scan.
**Spec for this phase:** `docs/api.md` (the UI contract, with a fixture per tool) and `knowledge-graph/game-design.md` ("Build today" column). The brief sets the rubric; where the brief and the game design differ, the game design and the API win, because the backend already implements them.
**Brief requirements covered:** Angular UI with loading, empty and error states, mobile-first; Merge Forward (keyboard, screen reader, no timers, badges not by color alone, pseudonymous handles, accessible mode, no-walking quests); Dash0 RUM; "every point is traceable" (trace link on each leaderboard row).
**Depends on:** PR 5 (merged): the backend, `docs/api.md`, the fixtures, the Angular shell with `ToolsService`, `MeService`, `StateWrapperComponent`, `ScreenToolbarComponent`, the Map screen. Nothing else.
**Owner:** Collin. **Budget:** 14:00–16:30, screens in demo-path order. Everything after section 5 is optional.
**Rules to load:** `rules/hackathon.md`, `rules/typescript.md`, `rules/angular.md`, `rules/ui.md`, `rules/scss.md`.

## Before you code

- [ ] Read `docs/api.md` once, top to bottom. It has the identity rule (`attendeeId` is a password; other players are `pl_…` public ids), the error envelope and what the UI does per `code`, the latency table (every write needs a spinner), and the polling table
- [ ] The fixtures changed shape in PR 5: each file is `{ request, status, response, variants }`. `ToolsService` fixture mode must return `.response` (and a named variant when asked), or every screen renders garbage on fixtures. Delete the stale `propose_intro.json` and `respond_intro.json`
- [ ] Confirm `resources/fixtures/` is served at `/fixtures/` in `ng serve` (angular.json `assets`), otherwise fixture mode 404s
- [ ] Today's data is Nov 10 talks, so `whats_next` and `recommend_talks` return empty against the live server unless it runs with `DEMO_NOW=2026-11-10T09:00:00-07:00`. Build the itinerary on fixtures first; ask Golden to set `DEMO_NOW` on the deployment for the demo

## Checklist

One PR per section, in this order. Screenshots at 375 px in every PR body. Every screen uses `StateWrapperComponent` for loading, empty and error.

### 0. Wiring (20 min) — `web/src/app/core/`

- [ ] `ConfigService`: `GET /api/config` once at boot (`APP_INITIALIZER`); exposes `publicBaseUrl`, `conferenceTimeZone`, `traceUrlTemplate?`, `rum?`
- [ ] `ToolsService`: unwrap fixture `.response`; `call<T>(name, input, { variant? })`; map the error envelope to a typed `ToolError { status, code, message }`
- [ ] `ToolErrorHelper`: `unknown_attendee` → `MeService.clear()` and go to `/signup`; 403 on a scan → "scan the code on the door" with the server message; 409 → show the message and refetch; 501 → hide the control; 5xx → "try again in a moment" and back off
- [ ] `PollingHelper.poll(fn, intervalMs, stopWhen)`: pauses when `document.visibilityState` is hidden, doubles the interval on 5xx up to 60 s, resets on success
- [ ] `MeService` already stores the id; add a route guard that sends a player with no id to `/signup`, carrying the intended URL (a scan URL must survive signup)
- [ ] Shared bits the game needs everywhere: `PixelFaceComponent` (8×8 grid from `faceSeed`, deterministic hash, `role="img"` with the handle as label), `MaterialChipComponent` (track → material name + icon + color, text always present), `LevelBarComponent` (from the `level` object: name, xp, `progress`), `XpToastComponent` (`+10 XP · 1 Glass block`, `aria-live="polite"`)
- [ ] Tabs: **Now** (`/here`), **Search** (`/map`, the existing Map screen plus the search box), **Quests** (`/quests`), **Board** (`/board`), **Me** (`/me`). Drop People as a tab: people live in Quests and on the Now card, which is where the API puts them. Rename route `intro/:introId` to `meet/:meetId`
- [ ] PR: `feat(web): config, typed tool errors, polling, game primitives`

### 1. Signup and scan result (25 min) — `web/src/app/signup/`, `web/src/app/scan/`

- [ ] `/signup`: handle (3–20, `^[a-z0-9_.-]+$`, `mat-hint` with the rule), "What are you working on, or hoping to get out of KubeCon?" textarea, "First KubeCon?" toggle, "Happy to welcome a first-timer?" (shown when not first), "Suggest people for me to meet" toggle with **no default** (the player must choose), then "How to spot me" when on; optional GitHub username; topic chips (up to 5). Spinner-in-button on submit (`sign_up` takes about 4 s). `409 handle_taken` inline on the handle field
- [ ] On success: store `profile.attendee.id`; show the pixel face, handle, `starterMaterial` block, the `personalLink` with a copy button and the sentence "This link is your login. Save it", then the `firstQuest` card with Accept / Not now. If the response has `checkIn`, show the scan result below it
- [ ] `/r/:locationId?t=`: with a stored id call `check_in` at once; without one go to `/signup` with `scanLocationId` and `scanToken` so the scan is credited on signup. Send `geo` only when `settings.locationOn`
- [ ] Scan result screen, one layout, three states from `status`: **awarded** ("+10 XP at Elastic", `material`, `gemsAwarded`, `levelUp` banner when present, `newBanners`, `completedQuests`, and "Take the quiz" when `quizAvailable`); **repeat** (the message, no XP); **rejected** (the message and `rejectedReason`). 403 → the server message plus "scan the code on the door". Then "Go to Now"
- [ ] `feat/booth-people-here` merged as PR 12 at 14:06 MST, so `check_in` now returns `peopleHere` (the shape is in PR 12's body; `docs/api.md` and the `check_in` fixture don't have it yet). When an **awarded** or **repeat** result has `peopleHere`, show "Also here" under it: up to 3 cards (face, handle, level, `reason`, shared topics), the same card as **Matches here** on Now, each with "Meet" → `propose_meet` with the player's `pl_…` id (`player.id`). The field is absent on campfire scans, on rejected scans and when the player has meeting off; show nothing then, and nothing for an empty list
- [ ] PR: `feat(web): signup with first quest, scan landing`

### 2. Now and the boss bar (25 min) — `web/src/app/here/`, `web/src/app/shared/components/boss-bar/`

- [ ] Now card from `whats_around_me`, polled every 30 s and right after any `check_in`: where you are (name, building, level), **Now** (talk, speakers, material chip, `isBoss`), **Next here**, `playersHere` as a count, `nearestCampfire` with walk minutes, **Matches here** (up to 3 `matchesHere` cards: face, handle, level, `reason`, shared topics, "Meet" → `propose_meet` with `player.id`). Empty state before the first scan: "Scan a room's QR block to start"
- [ ] `quizAvailable` → "Take the quiz" to `/quiz/:talkId`
- [ ] `BossBarComponent`: `boss_state` by `locationId` (or `talkId` + `attendeeId` to also get the questions), polled every 3 s until `defeated` or `escaped`; bar is `health / maxHealth` with the numbers as text, `participants`, `playersInRoom`, a countdown to `deadline` while `waiting` or `fighting`, a "Fight: take the quiz" button. Shown on Now when the location is a `boss-room`, and on the demo screen
- [ ] Next list from `whats_next`: `items` by `kind` (`talk`, `meet`, `quest`, `gap`) with place and walk minutes; a `gap` renders as a quiet divider
- [ ] PR: `feat(web): Now card, itinerary, boss bar`

### 3. Quiz (15 min) — `web/src/app/quiz/`

- [ ] `quiz_for_talk` with `attendeeId`: 3 questions (5 for a boss) as `mat-radio-group`s with visible legends, plain text, no timer, all on one page. Record `startedAt` when the screen opens. If the response already includes a result, show it instead of the form
- [ ] `submit_quiz` → per-question result (`chosenIndex`, `correctIndex`, `explanation`), `correct / total`, `xpAwarded`; when `boss` is present, show the damage dealt and the bar. `alreadySubmitted: true` → the stored result and no XP
- [ ] PR: `feat(web): talk and boss quiz`

### 4. Quests and Meet (30 min) — `web/src/app/quests/`, `web/src/app/meet/`

- [ ] Quests tab from `quest_board`, refreshed on tab focus and after every check-in: **Offers** (up to `maxOffers` cards), **Active** (up to `maxActive`), **Done today**. A card: type icon, title, `reason`, `nextStep`, `where`/`when`/`walkMinutes` when present, `reward.label`, and the three buttons: **Accept**, **Not now**, **Not for me** (with an optional one-tap reason: not my topic, too far, no time). Active cards get **Drop quest**. Each button calls `respond_quest` and replaces the whole tab with the returned `board`
- [ ] People inside Quests: a "Find someone to meet" section from `recommend_people` with a "Here now only" toggle (`hereOnly`); each card has "Meet" → `propose_meet`. Accepting a `chat` quest also proposes a meet and sets `quest.introId`; open `/meet/:meetId`
- [ ] `/meet/:meetId` from `list_meets` (find by id), polled every 10 s while `proposed` or `accepted`: `statusLine` as the headline, partner face and handle, `sharedTopics`. Once `accepted`: `campfire` (name, building, level, zone), `slot`, `icebreaker`, `chatPrompt`, `partnerDetails.spotMe` (and `realName`, `photoUrl` when present), and the **match signal**: an 8×8 grid from `matchSignal.pattern` plus the two words in the pixel font, large enough to hold up across a room. "Can't make it" → `respond_meet` with `cant_make_it`. `met` → "You met @handle", the XP, and a link to the board
- [ ] Incoming meets: a `proposed` meet where `role` is `partner` shows as a card with the partner's public card and Accept / Decline (`respond_meet`). Nothing about the proposer beyond the public card until accepted; a decline is silent on the other side (the server handles it; the UI just says "Done")
- [ ] PR: `feat(web): quest board, people, meet screen with match signal`

### 5. Board, Me, demo screen (25 min) — `web/src/app/board/`, `web/src/app/me/`, `web/src/app/screen/`

- [ ] Board: three boards (`overall`, `connectors`, `questers`) as a segmented control, `today` / `conference` toggle, rows with rank, face, handle, level name, `score`, banner icons with text labels; the `me` row pinned at the bottom when not in the top 20 (match with `isMe`, never by id). **Open trace** on each row from `latestTraceId` and `ConfigService.traceUrlTemplate`; hide it when there is no template
- [ ] Me (`/me`, and `/me/:attendeeId` as the personal link, which stores the id then redirects): `get_profile` and `inventory`: face, handle, level bar, blocks by material with counts and icons, gems, banners with `progress / target` and `earnedAt`; settings via `update_settings`: meeting on/off (warn that off withdraws open meets), accessible mode, no-walking quests, location on/off, hide from leaderboard; topics editor; "Copy my link"
- [ ] Demo screen `/screen/:locationId` (already full-screen in the shell): `GET /api/screen-token/:locationId` → draw `scanUrl` as a large QR with the `qrcode` package (add `qrcode@1.5.4` and `@types/qrcode`), refetch every 8 minutes; `BossBarComponent` by `locationId` at 3 s; `leaderboard` top 10 at 15 s; dark background, high contrast, no nav. `403 no_screen` → a plain message. For the demo the location is `cloud-native-hackathon`
- [ ] PR: `feat(web): leaderboards with trace links, Me, demo screen`

### 6. Search (15 min) — `web/src/app/map/`

- [ ] One search box above the existing Map screen: `search` with the query and filter chips (`now`, `nearMe`, `track`, `building`, `kinds`); results grouped by `kind` with `subtitle`, `startsInMinutes`, `walkMinutes`; a `session` or `outpost` result has "Make this a quest" (`make_quest`), a `player` result has "Meet", a `room` or `campfire` result jumps to it on the map
- [ ] Map rooms show `now` / `next`, `busyness` and `walkMinutes` from `world` (cache it for a minute; the fixture is 48 KB)
- [ ] PR: `feat(web): search over sessions, players and places`

### 7. Organizer (10 min) — `web/src/app/organizer/`

- [ ] `organizer_stats`: players, check-ins today, XP today by type as horizontal bars with numbers, `meets` funnel (proposed → accepted → met), `quests` counts, `busiestRooms`. Fixture-only is fine if time is short
- [ ] PR: `feat(web): organizer view`

### 8. Real tools and RUM (10 min)

- [ ] `environment.prod.ts`: `useFixtures: false`. Build into `app/public` as the Dockerfile expects; confirm `GET /r/<id>?t=` on the live URL serves the SPA
- [ ] Dash0 RUM: when `/api/config` returns `rum`, initialize the browser SDK in `main.ts` with it; nothing baked into the bundle. Confirm a page view and the `check_in` fetch appear in Dash0 linked to the server trace (needs the Dash0 keys in the Secret; ask Golden)
- [ ] Walk the loop on two phones against `https://kube-quest.cnh.radarhq.io` with two fresh handles; fix shape mismatches in the UI, not the api
- [ ] PR: `feat(web): live tools and RUM`

### 9. Accessible pass (30 min)

- [ ] Keyboard-only run of the whole loop: signup → paste a scan URL → Now → quiz → Quests → accept a chat quest → meet screen → Board. Visible focus ring (not the browser default), sensible order, `Escape` closes any sheet and focus returns to the trigger
- [ ] `settings.accessibleMode` turns the pixel font off everywhere and keeps the layout (the game design's rule); `noWalking` hides walk minutes and shows the board's no-walking offers unchanged
- [ ] Screen reader: every icon button has an `aria-label`; faces are `role="img"` with the handle; materials and banners read as text; XP results, level-ups and new-meet notices are `aria-live="polite"`; the boss bar has `role="progressbar"` with `aria-valuenow`
- [ ] Color: track materials and statuses always carry an icon or text; contrast ≥ 4.5:1 on body text, checked on the dark demo screen; `prefers-reduced-motion` stops the bar animation
- [ ] Text: quiz and transcripts plain, no timers anywhere, 16 px minimum, 200% zoom with no horizontal scroll at 375 px
- [ ] Privacy on screen: public views show handle and face only; `attendeeId` and the personal link appear only on Me; `spotMe`, `realName`, `photoUrl` only on an `accepted` or `met` meet
- [ ] PR: `feat(web): accessible mode pass`. Record the 10-second keyboard-only clip for the demo

## Cut order inside this phase

Organizer → Search (keep the Map) → Me settings editor (keep read-only Me) → connectors/questers boards (keep overall) → match-signal grid (keep the two words) → itinerary Next list (keep the Now card). **Never cut:** signup, scan result, Now card, boss bar, quiz, quest board with Accept, meet screen with campfire and words, overall board with trace links, demo screen QR, keyboard-only run.

## Done when

- [ ] On fixtures: every route renders at 375 px with loading, empty and error states; screenshots in the PR bodies
- [ ] On the live URL with two fresh handles: scan the demo-screen QR → signup → first quest → quiz on the kickoff talk drops the boss bar → both accept a chat quest → meet screen shows the same words on both phones → both scan the campfire → "You met" and the Connectors board moves. Under two minutes
- [ ] Board rows open a real Dash0 trace; RUM shows the page view
- [ ] Keyboard-only loop recorded; Lighthouse accessibility ≥ 95 on Now, Quests and Board
- [ ] Each PR has a Gitar review; the `game-integrity` privacy rule (no `photoUrl`/`spotMe` before mutual accept) holds in the templates too
