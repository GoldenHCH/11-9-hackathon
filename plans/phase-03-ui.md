# Phase 03 — Angular UI: on fixtures first, then the real tools, then the accessible pass

**Goal:** every screen on the demo path works on a phone at 375 px against `resources/fixtures/`, flips to the real tools with one flag once Phase 02 merges, and the whole loop can be run keyboard-only. The demo screen shows a live QR that judges scan.
**Brief requirements covered:** Angular UI (signup, profile, Here, quiz, people, intro, leaderboard, organizer occupancy; loading, empty and error states; mobile-first); Merge Forward (keyboard navigation, screen-reader labels, badges not by color alone, plain-text quiz with no timer, pseudonymous handles, "first time here?"); Dash0 RUM; "every point is traceable" (open-trace link).
**Depends on:** Phase 01 merged (the `web/` scaffold, `shared/` types, `resources/fixtures/<tool>.json`). Nothing in Phase 02; the UI reads fixtures until it merges.
**Owner:** Collin. **Budget:** 12:40–13:00 start, 14:30–16:30 finish (wire to real tools at 15:30, accessible pass at 16:00).
**Rules to load:** `rules/hackathon.md`, `rules/typescript.md`, `rules/angular.md`, `rules/ui.md`, `rules/scss.md`.

## Before you code

- [ ] Angular or Next.js, decided before the first UI commit. This plan assumes Angular 21 standalone + Material + SCSS; if Next.js, swap the rule files and keep the screens, states and the fixture flag exactly as written here
- [ ] `npm run dev` from Phase 01 serves `web/` on its own port and proxies `/api` to the Express app
- [ ] Skim `resources/fixtures/`: one JSON response per tool. Those shapes are the contract; if one is missing or wrong, fix the fixture in a tiny PR rather than inventing a shape in the UI

## Checklist

One PR per section, in this order. Screenshots at 375 px in every PR body.

### 1. Shell and data layer (20 min) — `web/src/app/core/`

- [ ] `ToolsService.call<T>(name, input)`: `POST /api/tools/:name`. With `environment.useFixtures = true` it returns `resources/fixtures/<name>.json` after a 300 ms delay instead, so loading states are visible. Flipping that one flag is the Phase 02 hand-off
- [ ] `MeService`: the personal link `/me/:attendeeId` writes `attendeeId` to localStorage; every screen reads it; no id → redirect to signup
- [ ] App shell: `ScreenToolbarComponent` on every page (`[ANG-05]`), bottom nav with five tabs (Here, People, Quests, Board, Me), `LoadingService` bar (`[UI-01]`), `AlertBannerComponent` for errors (`[ANG-07]`), `SidePanelComponent` as bottom sheet on mobile (`[UI-08]`)
- [ ] Theme tokens in `styles/_theme.scss`: one primary, one accent, track colors as a map (ai, security, networking, observability, platform, storage, other) used for shards and talk chips, each paired with an icon so color is never the only signal
- [ ] Routes: `/signup`, `/me/:attendeeId`, `/here`, `/r/:locationId` (scan landing, reads `?t=`), `/quiz/:talkId`, `/people`, `/intro/:introId`, `/board`, `/quests`, `/organizer`, `/screen/:locationId`. Lazy-loaded standalone components (`[ANG-01]`)
- [ ] Every data screen has three states: skeleton while loading, an empty state with one sentence and one action, an error banner with retry. Build them once as `StateWrapperComponent` and reuse
- [ ] PR: `feat(web): app shell, routing, fixture-backed tools service`

### 2. Signup and Me (20 min) — `web/src/app/signup/`, `web/src/app/me/`

- [ ] Signup form (`appearance="outline"`, max width 600 px): GitHub username (optional, with `mat-hint` "public profile only"), "What are you hoping to get out of KubeCon?" textarea, "First time here?" toggle, "Happy to welcome first-timers?" toggle. Submit shows the spinner-in-button pattern (`[UI-13]`); errors inline (`[UI-14]`)
- [ ] On success: store the id, show the generated profile (handle, headline, topic chips, offers, asks) with "Looks right" → Here. Copy of the personal link with a one-tap copy button and the sentence "This link is your login. Save it"
- [ ] Me screen: avatar, pseudonymous handle, XP, badges (icon + label + how earned), topics, the personal link again, a "Visible to others" toggle (`attendees.visible`), a "Reset demo" link in dev only
- [ ] PR: `feat(web): signup with profile preview and Me`

### 3. Scan landing and Here (25 min) — `web/src/app/scan/`, `web/src/app/here/`

- [ ] `/r/:locationId?t=`: calls `check_in` immediately, shows a full-screen result: "+10 XP · Regency Ballroom B" with the session running here and a "Take the quiz" button, or the plain-language rejection from the api (forged, expired, already scanned this hour) with "Go to Here". Not signed in → signup first, then the scan completes
- [ ] Here: where you are (room, venue, floor), **Now here** (session, speakers, track chip), **Next here**, **People you should meet, here now** (top 3 from `whats_around_me.peopleHere` with "Let's meet"), **Your next talk** from `whats_next` with "starts in 12 min · 6 min walk". Empty state when never checked in: "Scan a room's QR to start"
- [ ] Polls `whats_around_me` every 30 s while the tab is visible (no websockets)
- [ ] PR: `feat(web): scan landing and Here`

### 4. Quiz (15 min) — `web/src/app/quiz/`

- [ ] Three questions as `mat-radio-group`s with visible legends, all on one page, plain text, no timer, no progress countdown. Submit → result card per question (right or wrong, the correct answer shown) and "+10 XP". Already taken → shows the stored result
- [ ] Transcript excerpt toggle when `quiz.source === 'transcript'` ("Read the part of the talk this came from"), as plain text
- [ ] Quests tab: the quiz-only quest list (talks with a cached quiz you haven't taken) so a limited-mobility attendee can earn XP without walking; later Phase 05 adds "near you"
- [ ] PR: `feat(web): talk quiz and quiz-only quests`

### 5. People and Intro (30 min) — `web/src/app/people/`, `web/src/app/intro/`

- [ ] People: list of `PersonMatch` cards: avatar, handle, headline, shared-topic chips, "first-timer" or "welcomer" tag, distance or "seen in Hall C 20 min ago", the `why` sentence when present. Toggle "Here now only" (`hereOnly`). One button per card driven by `introStatus`: "Let's meet" → "Waiting for them" → "Accept" (when they proposed) → "Open"
- [ ] Nothing about an intro is shown to the other person until both have said yes. A `proposed` intro you received appears as a single card "Someone nearby wants to meet you" with the match's public card and Accept / Not now; declining shows no sender detail and never notifies them
- [ ] Intro detail (`accepted`): both avatars, "Meet at **Salt Palace coffee bar** · 3:30–3:45" (or "now"), the icebreaker as a quote, a map-free direction line ("Level 1, next to registration") from `locations`, and "Scan the QR at the point when you arrive". Arrival chips: "You're here ✓" / "They're here ✓". `met`: confetti-free success state, "+50 XP · Connector 2/3", "Say thanks" copy button with a one-line GitHub-flavored message
- [ ] Polls `GET /api/intros?attendeeId=` every 10 s; a new `accepted` intro raises a banner on every tab
- [ ] PR: `feat(web): people matches and Hallway intro flow`

### 6. Board, demo screen, organizer (25 min) — `web/src/app/board/`, `web/src/app/screen/`, `web/src/app/organizer/`

- [ ] Board: top 20 by XP with rank, handle, XP, badge icons with `aria-label`s; your own row pinned at the bottom if outside the top 20. Each row expands (side panel) to the attendee's latest XP events; each event has **Open trace** linking to Dash0 with its `trace_id` (URL shape from `docs/ops.md`)
- [ ] Demo screen `/screen/:locationId`: fills the projector. A large QR (the `qrcode` package, client-side) of `https://kube-quest.cnh.radarhq.io/r/<locationId>?t=<token>` where the token comes from `GET /api/screen-token/:locationId`, refreshed every 8 minutes; under it, the live top 10 polled every 5 s and a ticker of the last 5 XP events ("@quietgopher checked in to the kickoff · +10"). No nav, dark background, high contrast
- [ ] Organizer `/organizer`: occupancy per room as horizontal bars (count of attendees whose `lastLocationId` is that room, seen in the last 2 hours) and an intro funnel (proposed → accepted → met counts). Both from one `GET /api/organizer` aggregation endpoint; if Phase 02 hasn't shipped it, render from a fixture and leave the TODO out of the code (track it in Phase 05)
- [ ] PR: `feat(web): leaderboard with trace links, demo screen, organizer view`

### 7. Wire to the real tools (15 min, at 15:30 or when Phase 02 is merged)

- [ ] `environment.useFixtures = false` in the production build; keep `true` for `npm run dev` unless `.env` sets `USE_FIXTURES=false`
- [ ] Walk the loop on two phones against `https://kube-quest.cnh.radarhq.io` with the two demo personas; fix shape mismatches in the UI, not the api
- [ ] Dash0 RUM: initialize the browser SDK in `main.ts` with the token from an `/api/config` endpoint (never baked into the bundle); confirm a page view and the `check_in` fetch appear in Dash0 linked to the server trace
- [ ] PR: `feat(web): real tools and RUM`

### 8. Accessible pass (30 min, 16:00)

- [ ] Keyboard-only run of the whole loop: signup → scan (paste the URL) → Here → quiz → People → propose → accept → intro → Board. Every interactive element reachable in a sensible order, visible focus ring (not the browser default), no keyboard trap in the side panel, `Escape` closes it, focus returns to the trigger
- [ ] Screen reader: every icon button has an `aria-label`; badges and track chips read as text; the XP result and new-intro banner are `aria-live="polite"`; images have `alt` (avatars: the handle)
- [ ] Color: track and status never carried by color alone (icon or text alongside); contrast ≥ 4.5:1 on body text, checked on the demo screen's dark background too; `prefers-reduced-motion` disables the ticker animation
- [ ] Text: quiz and transcripts plain text, no timers anywhere, 16 px minimum, zoom to 200% without horizontal scroll at 375 px
- [ ] Public views (Board, demo screen, People) show pseudonymous handles only; the Me screen is the only place a GitHub login appears
- [ ] "First time here?" shows as a friendly tag on your own card and drives the welcomer pairing; no one else's first-timer status is shown except on an accepted intro
- [ ] PR: `feat(web): accessible mode pass`. Record the 10-second keyboard-only clip for the demo

## Cut order inside this phase

Organizer view (fixture only) → Quests tab (link to quizzes from Here instead) → demo-screen ticker (QR + top 10 stay) → side-panel event history on Board (keep the Open-trace link on the row's latest event). **Never cut:** scan landing, Here, quiz, People with "Let's meet", intro detail with arrivals, Board, demo screen QR, keyboard-only run.

## Done when

- [ ] On fixtures: every route renders at 375 px with loading, empty and error states; screenshots in the PR bodies
- [ ] On the live URL with the demo personas: scan → +10 XP → quiz → match → propose → accept → intro → both scan → "+50 XP" and the badge progress, on two phones, in under two minutes
- [ ] The demo screen shows a QR that a judge's phone opens to a working scan landing
- [ ] Board rows open a real Dash0 trace; RUM shows the page view
- [ ] Keyboard-only loop recorded; Lighthouse accessibility ≥ 95 on Here, People and Board
- [ ] Seven PRs opened, each with a Gitar review
