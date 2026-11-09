# Phase 02 — Tools for real: signed check-in, XP, Hallway, quiz, badges

> **Status (14:50 MST): done, apart from the small leftovers below.** Checked against `origin/main` (`69d5f47`, live as `0110194`):
> - **1. Gitar's three PR 5 findings: done** (PR 15). Minting a screen token needs a per-location display key, `screen_token` is blocked on the public tools router, the boss bonus is create-only with a deterministic id, and `claimQuiz` goes through `award.ts`.
> - **2. A working model: done.** The app's key reaches the Agent Builder agent `kubequest-writer` (PR 10, PR 14). PR 14 put each model call on a per-purpose time budget (topics 4 s, chat 9 s, quizzes 13 s) so signup stays under the gateway's 15 s limit, with the deterministic fallbacks behind it. `docs/ops-ai.md` still describes the 403s from before PR 10; update it in the last mile. No OpenAI fallback, on purpose.
> - **3. Dash0 keys: done** (Collin; `docs/sponsor-tools.md`: spans from the cluster show in Dash0).
> - **4. `DEMO_NOW`: decided, leave it unset.** At 14:47 `boss_state` for `cloud-native-hackathon` read `fighting`, 10/10, on the real clock. Setting `DEMO_NOW` to Nov 10 would make it `escaped`.
> - **5. "Who else is here"** (PR 12) is live. Still not in `docs/api.md` or `resources/fixtures/check_in.json` (`peopleHere` appears in neither). No owner.
> - **6. `GITHUB_TOKEN` and the `index-all` bundle:** unchanged, no owner.
> - **PR 9** (signed check-in): empty diff against `main`. Close it.
> - The meet flow changed after this phase: PR 16 (`phase-06-handshake-booth-notes.md`) completes meets with a phone-to-phone handshake, not a double campfire scan.
>
> **Status (13:55 MST):** superseded by PR 5, "KubeQuest backend v1", which built sections 1–8 in one PR against `knowledge-graph/game-design.md` (23 tools, quests, boss rooms, meets, levels; see `docs/api.md`). The file names and tool names below no longer match the code. What is left of this phase:
> 1. **Gitar's three findings on PR 5**, merged unaddressed: unauthenticated `GET /api/screen-token/:locationId` and the `screen_token` tool let anyone check in to a boss room remotely; the boss defeat bonus can pay more than once under concurrent `boss_state` polls (needs a deterministic event id with `op_type: create`); `claimQuiz` writes to `xp_events` outside `app/src/xp/award.ts`, breaking `.gitar/rules/game-integrity.md`. One PR, referencing the review.
> 2. **A working model.** Elastic completion endpoints return 403 and Agent Builder lacks the `agentBuilder:read` Kibana privilege (`docs/ops-ai.md`), so quizzes and icebreakers are deterministic fallbacks. Ask Sophia for a key with Kibana privileges and the LLM entitlement; otherwise add an OpenAI fallback to `app/src/ai/client.ts`.
> 3. **Dash0 keys** (`DASH0_AUTH_TOKEN`, `DASH0_ENDPOINT`) in `app-credentials`, then confirm a trace in Dash0.
> 4. `DEMO_NOW` on the deployment so the itinerary and talk recommendations have Nov 10 talks to show.
>
> **Owners (14:10 MST),** checked against `origin/main` (`5e290cb`, live as `ae5e756`), `gh pr list` and the local branches:
> - **1. In flight, Golden:** branch `fix/gitar-pr5-findings`. A local worktree with no commits yet; nothing pushed, no PR.
> - **2. Unowned** (no session, no branch); Golden's next after the Gitar fixes. PR 10 (merged) changed the picture: the model layer is the Agent Builder agent `kubequest-writer` (`ELASTIC_AGENT_ID` in `deploy/deployment.yaml`), and quizzes for 25 talks, written by that agent, are committed in `resources/sessions.json`. PR 10's body says the `kube-quest-app` key still needs the Kibana `agentBuilder` privilege and that the app uses the fallbacks until it has it. Whether the key in the Secret has it now: not checked. There is no OpenAI code in `app/src/ai/` yet, and `docs/ops-ai.md` still describes the state before PR 10.
> - **3. Collin** owns the Dash0 keys and the first trace (`phase-04-ops.md`).
> - **4. Unowned** (no session, no branch); Golden's next. `DEMO_NOW` is not in `deploy/deployment.yaml`. Decide the value before setting it: `resources/sessions.json` has a demo boss, `cnh-demo-boss-2026`, at `cloud-native-hackathon` from 13:00 to 18:30 on Nov 9, which fights on the real clock. From reading `app/src/world/clock.ts` and `app/src/quests/boss.ts` (not run): `DEMO_NOW=2026-11-10T09:00:00-07:00` moves the world clock past that boss's deadline, so `boss_state` for the demo room would read `escaped`. See `phase-05-widen.md`, item 7.
> - **5. New, Golden: "who else is here" on a scan.** Branch `feat/booth-people-here`, merged as PR 12 at 14:06 and live. `check_in` returns `peopleHere`: up to 3 opted-in players whose last scan was this location within the last 20 minutes; the "here only" people filter (`recommend_people` with `hereOnly`, and `matchesHere` on `whats_around_me`) gets the same 20-minute window. **Left over, unowned:** the PR's Elasticsearch test steps were unchecked when it merged, and `docs/api.md` and the `check_in` fixture don't have `peopleHere` yet. Phase 03 section 1 shows it on the scan result.
> - **6. Unowned: `GITHUB_TOKEN`.** `app/src/profile/github.ts` calls the GitHub API with no token (60 requests an hour per IP), so it needs the Secret key and the header. The broken `index-all` bundle (`phase-01-data.md`) is also unowned.
> - PR 9 (signed check-in, section 1 below) is empty after merging `main` and stays open.

**Goal:** every tool in `app/src/tools/` does its real job against Elasticsearch, so the demo path runs end to end from curl before the UI is wired: a signed scan awards XP, the leaderboard aggregates it, Hallway matches two people, arranges the meeting and verifies the handshake, the quiz comes from the kickoff transcript, and a badge fires.
**Brief requirements covered:** Elastic as the core data layer (hybrid + RRF, `geo_distance`, aggregations, Agent Builder, Workflows); the Gitar security story's second half (signed tokens, rate limit); Merge Forward (mutual opt-in, first-timer ↔ welcomer, no timers); "every point is traceable" (trace id on each XP event).
**Depends on:** Phase 01 merged (types in `shared/`, five indices, seed, fixtures, tool signatures and stubs, check-in v1). Phase 03 builds against the fixtures in parallel; the signatures do not change in this phase.
**Owner:** Golden. **Budget:** 12:40–13:00 start, 14:30–15:30 finish (lunch and the Kelsey panel in between; let the agent keep going).
**Rules to load:** `rules/hackathon.md`, `rules/typescript.md`, `rules/ai.md`, `rules/git.md`.

## Before you code

- [ ] Sophia's answers from 11:45: Agent Builder and Workflows on or off for the trial. If off, the fallbacks below are the plan, not a detour
- [ ] `QR_SECRET`, `GITHUB_TOKEN`, `OPENAI_API_KEY` and the Elastic endpoint are in the `app-credentials` Secret (Collin) and in your local `.env`
- [ ] Read Gitar's review of the Phase 01 PR. If it flagged the unsigned check-in, screenshot it into `docs/screenshots/gitar-checkin-v1.png`. If it didn't, add the rule to `.gitar/review/` in this phase's first PR so it catches the next one

## Checklist

One PR per section below, in this order. Open each PR the moment its section works from curl; don't batch.

### 1. Check-in v2 — the security story (20 min) — `app/src/tools/check-in.ts`, `app/src/security/tokens.ts`

- [ ] `signLocationToken(locationId)` = base64url HMAC-SHA256 over `locationId` with `QR_SECRET`; `signScreenToken(locationId, exp)` over `locationId + "." + exp`; `verifyToken(locationId, token)` accepts either form, rejects a bad signature or an `exp` in the past. Constant-time compare
- [ ] `check_in` now requires `token`; a forged or expired token returns a 403 with a plain-language message ("That code isn't valid any more. Scan the one on the room's door")
- [ ] One scan per attendee per location per hour: a `count` query on `xp_events` (`attendeeId`, `locationId`, `type: check_in`, `at >= now-1h`) before writing. A repeat returns the existing event and 0 XP, not an error
- [ ] On success: write `xp_events` (`check_in`, 10 XP), update `attendees.lastLocation`, `lastLocationId`, `lastSeenAt`; return `{ location, xp, event, sessionNowHere? }`
- [ ] `GET /api/screen-token/:locationId` mints a 10-minute screen token (the demo screen in Phase 03 calls it every 8 minutes). `GET /r/:locationId?t=...` is the printed-QR landing route: it serves the web app, which reads the query and calls `check_in`
- [ ] Span attributes on this tool: `kubequest.tool=check_in`, `kubequest.location.id`, `kubequest.xp.awarded`, `kubequest.checkin.rejected_reason` when rejected. Counter `kubequest.checkins` by `location.id`
- [ ] PR title: `feat: signed QR tokens and scan rate limit`. Reference the v1 review in the body. This PR is a demo exhibit

### 2. XP ledger and leaderboard (15 min) — `app/src/xp/award.ts`, `app/src/tools/leaderboard.ts`

- [ ] `awardXp({ attendeeId, type, xp, talkId?, locationId?, introId? })` is the only writer to `xp_events`. It stamps `at`, the current `trace_id` (from the active span) and returns the event. Every tool that awards XP calls it
- [ ] `attendees.xp` is kept in step with a scripted `inc` update inside `awardXp` (no user input in the script; the amount is a param)
- [ ] `leaderboard({ limit })`: `terms` on `attendeeId` with a `sum` of `xp`, top `limit`, then one `mget` on `attendees` for handle, avatar and badges. Pseudonymous handle only, never name or GitHub login
- [ ] Each leaderboard row carries its latest XP event with its `trace_id`, so the UI can link "open trace" to Dash0. Agree the Dash0 trace-URL shape with Collin and put it in `docs/ops.md`
- [ ] Metric `kubequest.xp.awarded` counter with `type` attribute; `kubequest.handshakes` counter
- [ ] PR: `feat: XP ledger with trace ids and leaderboard aggregation`

### 3. Profile builder (20 min) — `app/src/ai/profile.ts`, `app/src/ai/prompts.constants.ts`, `POST /api/signup`

- [ ] Fetch GitHub public data with the token from the Secret: `/users/:login`, `/users/:login/repos?sort=pushed&per_page=10`, the README of the top 3 repos trimmed to 1,500 chars each. A missing or private login is fine: the two answers alone are enough (`[AI-07]`)
- [ ] One model call: GitHub text + "what are you hoping to get out of KubeCon?" + "first time here?" + "happy to welcome first-timers?" → `Profile` JSON (topics, seniority, goals, offers, asks, languages, firstTimer, welcomer). Validate against the interface, retry once, then fall back to a rules-only profile from the answers (`[AI-08]`)
- [ ] Write the `attendees` doc with `profileText` (one paragraph the model wrote, this is what `semantic_text` embeds), `headline`, `avatarUrl`, a generated pseudonymous `handle`, `visible: true`, `xp: 0`
- [ ] Return the attendee and its personal link `/me/<attendeeId>`; the UI stores it in localStorage. No passwords, no sessions
- [ ] Prompts live in `prompts.constants.ts`; no prompt text inside tool or route code
- [ ] PR: `feat: GitHub-grounded profile builder`

### 4. Talk and people matching (25 min) — `app/src/tools/recommend-talks.ts`, `recommend-people.ts`, `whats-around-me.ts`, `whats-next.ts`

- [ ] `recommend_talks`: hybrid query on `talks` fused with RRF: `semantic` on `searchText` with the attendee's `profileText`, plus `multi_match` on `title`/`abstract` with the attendee's topics. Filter `start > now` and the requested day; exclude talks already checked into. Return `TalkMatch[]` with `startsInMinutes` and `walkMinutes`
- [ ] `recommend_people`: hybrid query on `attendees` (`semantic` on `profileText` with the requester's `profileText` + `terms` boost on shared topics), filter `visible`, exclude self and anyone with an open intro. `should` boosts: `firstTimer` requester ↔ `welcomer` candidate and the reverse; `lastSeenAt` within 2 hours. `hereOnly: true` adds a `geo_distance` filter (150 m) around the requester's `lastLocation`. Return `PersonMatch[]` with `distanceMeters`, `sharedTopics`, `isFirstTimer`, `isWelcomer`, `introStatus`
- [ ] `why` text for a match: Agent Builder (fallback OpenAI) from both profiles, one sentence, cached on the pair key in memory with a 1-hour TTL. The list renders without it when the call is slow (`[AI-11]`)
- [ ] `whats_around_me`: the attendee's `lastLocationId` → sessions running now and next in that room (`range` on `start`/`end`), people with the same `lastLocationId` seen in the last 2 hours (top 10 by the people query above). No model
- [ ] `whats_next`: the attendee's top `recommend_talks` pick for the next 3 hours, with `walkMinutes = geo_distance / 80 m per min + 10 if the venue differs`
- [ ] Sanity check with the two demo personas: each is the other's top `recommend_people` result; the frontend first-timer's top talk is a 101
- [ ] PR: `feat: hybrid talk and people matching`

### 5. Hallway Intros (30 min) — `app/src/tools/propose-intro.ts`, `respond-intro.ts`, `app/src/hallway/schedule.ts`, `meeting-point.ts`

- [ ] `propose_intro({ fromId, toId })`: if an intro `proposed` by `toId` to `fromId` already exists, accept it (both said yes). Otherwise write `intros` with `status: proposed`. Nothing about `toId` is revealed beyond what the people list already shows. Duplicate proposal returns the existing intro
- [ ] `respond_intro({ introId, attendeeId, response })`: only `toId` may respond; `decline` sets `declined` and the pair is excluded from each other's lists for the day; `accept` runs the three steps below and sets `accepted`
- [ ] **Slot:** each person's agenda = the session they're checked into now plus their next 3 recommended talks. Walk both agendas from now to 18:00 in 5-minute steps and take the first 15-minute gap free for both; if none, `slot = now..now+15` ("meet now"). Pure set arithmetic, no model (`[AI-03]`)
- [ ] **Meeting point:** `locations` with `kind: meeting-point`, sorted by `geo_distance` from the midpoint of both `lastLocation`s (the proposer's alone if one is missing). Store `meetingPointId`
- [ ] **Icebreaker:** Agent Builder (fallback OpenAI) from both profiles and shared topics, two sentences, in the proposer's first language; validated, retried once, fallback "You both work on <topic>. Ask what broke last." Stored on the intro
- [ ] **Arrival and handshake:** inside `check_in`, when the location is a meeting point and the attendee has an `accepted` intro at that point, append `{ attendeeId, at }` to `arrivals`. When both arrivals are within 30 minutes: `status: met`, `awardXp` 50 to each (`handshake`), +25 `welcome` to the welcomer if the other is a first-timer. Idempotent: a second scan doesn't double-award
- [ ] `GET /api/intros?attendeeId=` lists an attendee's intros in all statuses (the UI polls it every 10 s)
- [ ] Seed check: the two demo personas have no intro between them so the live demo creates one
- [ ] PR: `feat: Hallway intros with slot, meeting point and verified handshake`

### 6. Quiz (20 min) — `app/src/tools/quiz-for-talk.ts`, `submit-quiz.ts`, `app/src/ai/quiz.ts`

- [ ] `quiz_for_talk({ talkId })`: if `talks.quiz` is set, return it. Otherwise gather context: the top 8 `transcript` chunks for the talk by a `semantic` query on its title (`source: transcript`), or the abstract when there are no chunks (`source: abstract`). Agent Builder (fallback OpenAI) → `Quiz` JSON: 3 questions, 4 choices each, one answer index, plain text, no "all of the above". Validate, retry once, then cache on the `talks` doc
- [ ] Pre-generate quizzes for every talk with a seeded transcript at seed time (`scripts/index-all.ts` calls the same function) so the demo never waits on a model
- [ ] `submit_quiz({ attendeeId, talkId, answers })`: grade in code; 5 XP per correct answer via `awardXp` (`quiz`); one graded submission per attendee per talk (a repeat returns the stored result and 0 XP); return `{ correct, total, xp, explanations? }`. Histogram `kubequest.quiz.duration`
- [ ] Spans: `kubequest.talk.id`, `kubequest.quiz.source`
- [ ] PR: `feat: transcript-grounded talk quiz`

### 7. Badges (15 min) — Elastic Workflow or `app/src/xp/badges.ts`

- [ ] Three rules, all code or Workflow conditions, no model: **Observability Nerd** = 3 `check_in` events whose talk is `track: observability`; **Connector** = 3 `handshake` events; **Welcomer** = 2 `welcome` events
- [ ] If Workflows are enabled: one Workflow triggered on new `xp_events` docs that runs the three counts and, on a threshold, appends to `attendees.badges` and writes a `badge` XP event (0 XP). Export its definition to `resources/workflows/badges.json` and commit it
- [ ] If not: `evaluateBadges(attendeeId)` runs at the end of `awardXp`, same rules, same writes. Say which path is live in `docs/ops.md`
- [ ] A badge event carries `kubequest.badge` on its span so a badge firing is visible in Dash0 during the demo
- [ ] PR: `feat: badges via Elastic Workflow` (or `… computed in the api`)

### 8. Model layer (runs alongside 3–6) — `app/src/ai/client.ts`

- [ ] `generateJson<T>(prompt, schemaCheck, opts)`: Agent Builder converse call first (agent grounded on `talks` and `attendees`), OpenAI JSON mode second, one retry on invalid JSON, 8-second timeout, every call in a span `ai.generate` with `kubequest.ai.provider`, `kubequest.ai.purpose`, `kubequest.ai.cache_hit`
- [ ] No tool imports the model client directly; tools call `ai/profile.ts`, `ai/quiz.ts`, `ai/hallway.ts`, which call `generateJson`. This keeps `app/src/tools/` model-free so the Gitar rule holds
- [ ] Record the Agent Builder agent id and the inference endpoint in `docs/ops.md`

## Cut order inside this phase

Quiz for non-seeded talks (abstract path) → `why` text (list works without it) → Workflow badges (compute in api) → slot and meeting point (fall back to "meet now at the nearest point to the proposer") → `hereOnly` filter. **Never cut:** signed check-in, `awardXp` with trace ids, leaderboard, people match, propose/respond, handshake award, seeded quiz.

## Done when

- [ ] From curl, with the two demo personas: scan with a bad token → 403; scan with a good token → 10 XP and a leaderboard row with a `trace_id`; `recommend_people` puts them first for each other; A proposes, B accepts → slot + meeting point + icebreaker; both scan the meeting point → `met`, 50 XP each, Connector progress; `quiz_for_talk` for a kickoff talk returns 3 cached questions; `submit_quiz` grades and awards
- [ ] A forged-token scan and a handshake each appear as traces in Dash0 with `kubequest.*` attributes (Collin's Phase 04 collector is live)
- [ ] Seven PRs opened, each with a Gitar review; the check-in v2 review screenshot is in `docs/screenshots/`
- [ ] `docs/ops.md` says which model path and which badge path are live
