# Cloud Native Hackathon (WeMakeDevs × Kelsey Hightower) — Working Context

**Event:** Cloud Native Hackathon, Mon Nov 9 2026, The Shop Workspace, Salt Lake City (in person, during KubeCon NA week)
**Format:** team of two (Golden, Collin) · build 11:00 AM → 5:30 PM MT · **our deadline 5:15** · demos 5:30–6:30 · winners 6:30
**Prize:** Best overall → NVIDIA DGX Spark · four $4,000 sponsor tracks · Merge Forward iPad · top 10 → signed *Kubernetes: Up & Running*
**Judges:** Kelsey Hightower, Justin Garrison, Nadav Erell (Radar), Julia Furst Morgado (Dash0). Sponsor judges will check their tool was used, not name-dropped.
**Sources:** https://www.wemakedevs.org/hackathons/cnh · https://www.wemakedevs.org/hackathons/cnh/rules · https://luma.com/cnh · Collin's KubeQuest PRD (kickoff notes) · https://github.com/skyhook-io/cnh-starter

**Name:** KubeQuest. The meeting feature inside it is called **Hallway**.

**Merged from two PRDs:** KubeQuest (game loop, sponsor-specific Elastic features, cnh-starter platform, OTel collector) and Hallway (GitHub profiles, mutual opt-in Intros with a slot, a meeting point and an icebreaker, assistant + MCP). Every section below is the merged version.

---

## 1. The problem in one paragraph

KubeCon NA has 600 sessions and 10,000 people. Attendees skip talks, stay in their bubble, and leave without meeting the person working on their exact problem. Even when they know who to meet, the meeting doesn't happen: they can't find the person, don't know when both are free, and don't know how to start. Sponsors want booth traffic, and organizers can't see engagement. KubeQuest is a game whose points reward what a conference wants people to do, show up, listen and meet, and whose Hallway feature arranges the meeting for you.

## 2. The pitch (one sentence)

KubeQuest is a conference game where points come from showing up, listening and meeting people, and where the meeting actually gets arranged: sign up with your GitHub, scan the QR at a room to earn XP, take a three-question quiz on the talk, and let Hallway match you with someone nearby, propose a time and a spot you're both free for, and hand you an icebreaker.

## 3. Judging rubric — everything follows from this

No weights are published. "Projects can enter every sponsor track whose tool it genuinely uses, plus Merge Forward." Every track also requires that the project **"makes conferences easier."** Organizers said using all four tools is the recommended path to the DGX Spark.

| Track | Criteria (event page + what the sponsor said at kickoff) | How we win it | Priority |
|-------|-------------------------------|---------------|----------|
| **Elasticsearch** ($4k) | ES is the core data layer; smart keyword/semantic/vector/hybrid. **Sophia:** depth and creativity, Jina models via Elastic Cloud, Agent Builder, Workflows, geo queries, Serverless | Five indices and nothing else. Hybrid (BM25 + semantic, RRF) for people matching and talk recommendations. `geo_distance` picks the nearest meeting point and sorts "near you". **Agent Builder** is the model layer: quizzes from transcripts, "why this person", icebreakers, grounded in our indices. A **Workflow** fires badges from XP events. Leaderboard and organizer stats are aggregations | **Core** |
| **Dash0** ($4k) | Traces, logs, metrics, RUM; Agent0 or MCP finds and fixes something real, shown in the demo; observability as product; bonus dashboard or SLO. **Evgeny:** scored on OTel craft: instrumentation, **semantic conventions**, **collector configs**, **logs correlated with traces** | In-namespace **OTel Collector** with its config committed (`memory_limiter`, `batch`, resource attributes via downward API, Dash0 exporter). Standard `http.*` and `db.system=elasticsearch` spans plus `kubequest.*` attributes. JSON logs with `trace_id`/`span_id`. Metrics: XP awarded, check-ins per room, handshakes, quiz duration. RUM in the browser. **Product angle:** "every point is traceable", click a leaderboard entry and open its trace; room occupancy and the intro funnel are Dash0 dashboards. SLO: check-in p95 < 500 ms | **Core** |
| **Radar** ($4k) | Runs on Kubernetes with Radar connected; Radar UI + MCP used while building and operating; AI investigation on a real issue. **Roy:** "meaningful decisions Radar helped you with" (verified healthy releases, checks, rollouts) | Build on **cnh-starter**: `git push` → Argo CD → `team-<name>` namespace, live at `https://<team>.cnh.radarhq.io`. Radar MCP in Claude Code from hour one; after every merge ask Radar whether the rollout is healthy. Keep `docs/radar-log.md` of decisions. Run the AI investigation on the first real incident | **Core** |
| **Sonar / Gitar** ($4k) | Features land through PRs Gitar reviewed; review instructions + repo rules; CI failure diagnosis and auto-apply. **Kelly:** the security sponsor; Gitar catches logic and security bugs, auto-applies, learns from corrections | `.gitar/review/` instructions specific to KubeQuest. One PR per feature from the first hour, aim for 10+. The honest security story: check-in v1 trusts the location id in the URL, Gitar (or our rule) flags it, the next PR adds HMAC-signed tokens and one scan per attendee per location per hour. One real CI failure diagnosed and fixed by Gitar | **Core** |
| **Merge Forward** (iPad) | Inclusive and accessible | Intros are **mutual opt-in**; nothing is shown until both say yes. "First time here?" flag; first-timers matched with opted-in welcomers, and welcoming earns XP. Quizzes and transcripts as plain text with no timers (Deaf and hard-of-hearing attendees). A quiz-only quest that needs no walking (limited mobility). Keyboard navigation, screen-reader labels, badges not by color alone. Pseudonymous handles in public views | **Core, under 45 min** |
| **Best overall** (DGX Spark) | No rubric | A QR on the demo screen; judges check in live, their XP hits the leaderboard, their check-in appears as a trace in Dash0, and two of them shake hands via Hallway | — |

## 4. Hard requirements

- "The main coding and design work must begin after the hackathon starts."
- "Every submission needs a public source-code repository and a README with setup instructions."
- "AI coding assistants are allowed, but their use must be disclosed." → README section.
- "You have to understand the code you submit and be able to explain the project architecture." Both of us, without notes.
- "Use only data, tools and accounts you own or have permission to use." No private or personal data in the repo or demo: seeded or fake attendees, pseudonymous handles. **The raw kickoff recording contains teammates' side conversations and the venue Wi-Fi password. Only the trimmed sponsor-talk transcript may be committed.**
- One project per team. **Register the team on the hackathon site and add both names before the one submission.** Submit for Sonar, Dash0, Radar, Elastic and Merge Forward.
- Submissions close **5:30 PM MT**. Ours: **5:15**.
- Every track: "makes conferences easier."

## 5. Data provided

- **KubeCon NA 2026 schedule:** JSON-LD on the public schedule page, verified 10:20: **300 sessions** with title, start/end, URL, location ("Hyatt Regency | Level 4 | Regency Ballroom B-D"), description (271), speakers. Ingest once → `resources/sessions.json` (committed). `track` and `level` are rules-based from the title. Rooms come from the location strings.
- **Transcripts:** the trimmed kickoff sponsor talks (Dash0, Sonar, Elastic, Radar) as seeded transcripts, chunked into `semantic_text`. The Kelsey panel if we may record it. For the other ~296 sessions, quizzes come from the abstract instead, so the quiz works for every talk, just shallower.
- **Locations:** `resources/locations.json`: rooms from the schedule, 3–4 **meeting points** (Salt Palace coffee bar, Hyatt L4 foyer, the hackathon venue), and a few **booths** (roadmap). Each has `kind`, `venue`, `floor`, and a hand-placed `geo_point` (relative coordinates are fine; `geo_distance` only needs consistency). Each gets a QR.
- **QR tokens:** printed codes carry a **signed static token** (HMAC of `locationId`); the demo screen shows a **signed expiring token** (`locationId` + `exp`, 10 min). The api verifies the signature, the expiry when present, and one scan per attendee per location per hour.
- **Attendee profiles:** GitHub public API (`/users/:name`, `/users/:name/repos`, top README snippets) with a token in the Secret, plus "what are you hoping to get out of KubeCon?" and "first time here?". Seed ~150 clearly fake attendees with GitHub-style profiles, check-ins spread across rooms, a few intros in each status, and XP so the leaderboard isn't empty.
- **No Luma API** (paid plan). Signup is our page.

## 6. Scope

### Must have (demo path)

- **Signup → profile:** GitHub username + two answers → `[AI]` → profile (topics, seniority, goals, offers, asks, firstTimer, welcomer) → `attendees`. Personal link in localStorage; no passwords.
- **Check-in → XP:** scan a location QR; the api verifies the token; writes an `xp_events` doc (`type: check_in`, 10 XP); updates `lastLocation` and `lastSeenAt`. The **Here** screen: this room, what's on, people you should meet who are here now, your next talk.
- **Talk quiz:** after check-in, three multiple-choice questions from the talk's transcript chunks (or abstract) via Agent Builder, cached per talk, 5 XP per correct answer. Plain text, no timer.
- **Hallway (people match + Intros):** hybrid search over profiles, preferring people checked in nearby and first-timer ↔ welcomer pairs. Either side taps "Let's meet"; when both have, the intro is accepted: first 15-minute gap in both agendas, nearest meeting point by `geo_distance`, `[AI]` icebreaker, each other's GitHub photo. Scanning the meeting-point QR records arrival; both arrived within 30 minutes = **verified handshake**, 50 XP each (+25 if one is a first-timer).
- **Leaderboard + badges:** leaderboard = `sum` aggregation over `xp_events` by handle. At least three badges ("Observability Nerd" = 3 observability-track check-ins, "Connector" = 3 handshakes, "Welcomer" = 2 first-timer handshakes) via an Elastic Workflow, computed in the api if Workflows aren't enabled on the trial.
- **The tools module:** `check_in`, `recommend_talks`, `recommend_people`, `whats_around_me`, `whats_next`, `propose_intro`, `respond_intro`, `quiz_for_talk`, `submit_quiz`, `leaderboard`. The only way anything touches data. No model inside.
- **Accessible mode** (Merge Forward list above) and a keyboard-only run of the whole loop.
- **Platform:** cnh-starter → Argo CD → `team-<name>`; OTel Collector with committed config; RUM; Gitar on every PR; Radar MCP connected; `docs/radar-log.md`.
- **Angular UI:** signup, profile, Here, quiz, people, intro, leaderboard, organizer occupancy. Loading, empty, and error states. Mobile-first.

### Nice to have (in order)

- **Organizer view:** occupancy heat map and intro funnel from aggregations, mirrored as a Dash0 dashboard with the SLO.
- **Assistant + MCP:** one input box over the tools; the same tools exposed via the MCP TypeScript SDK.
- **Nudge CronJob:** "your match is in Hall C and you're both free at 3:30" → in-app feed. Radar gets a second workload.
- **Quests near you:** `geo_distance` sort of open quests from your last check-in.
- **Crafting:** spend shards (track-colored check-ins) and diamonds (handshakes) on Compass (see who's in any room) and Lantern (highlighted intro requests). Roadmap unless everything above is green by 3:30.
- Booth check-ins, XP-velocity anti-cheat flag, speaker view of quiz scores, `.ics` export.

### Explicitly out of scope

- Native apps; live audio upload or transcription (seeded transcripts only); real attendee data or logins; passive tracking of anyone; smart badges (roadmap: a BLE badge is an automatic `check_in`).
- Luma, LinkedIn, X integrations. Socials are links only.
- Indoor routing. Walking time is `geo_distance` plus a venue-switch constant.
- Websockets (poll), live schedule sync (snapshot), a second datastore, a chat thread.

## 7. Demo script (3 minutes, 90-second cut)

1. **0:00–0:20 · Hook.** "Conferences are a game nobody gave you the rules for." QR on screen; judges check in on their phones. XP appears on the leaderboard.
2. **0:20–1:10 · Play.** A judge's quiz is generated from the kickoff talk they sat through this morning. Then Hallway: two judges are each other's top match, one taps "Let's meet", the other accepts, "meet now at Point A", faces and an icebreaker, they shake hands, both earn 50 XP, a badge fires. Ten seconds of keyboard-only accessible mode.
3. **1:10–1:30 · Every point is traceable.** Click the judge's XP event in the leaderboard and open its trace in Dash0: web → api → Elasticsearch, `kubequest.*` attributes, correlated logs.
4. **1:30–2:30 · The incident.** Radar's AI investigation names the Kubernetes cause, Agent0 points at the code, the fix PR shows Gitar's review (and the check-in security catch from this morning), Argo CD redeploys, Radar's checks and the Dash0 SLO go green.
5. **2:30–3:00 · Close.** PR list, `docs/radar-log.md`, Dash0 dashboard. "Live at `<team>.cnh.radarhq.io`. Keep playing at the after-party." Roadmap slide: booths, crafting, BLE badges.

Backup screen recording of steps 2–4 by 5:00 PM.

## 8. AI approach

```
GitHub + answers → [AI] → profile
Transcript chunks (ES) → [Agent Builder] → 3 quiz questions (JSON, validated, cached)
Question / profiles / match → [Agent Builder] → "why", icebreaker, answer in the user's language
Everything else is ES queries, aggregations and rules inside the tools.
```

- The model parses input and phrases output. Ranking is ES (hybrid, geo), scoring is XP rules, scheduling is set arithmetic over two agendas (`[AI-03]`, `[AI-05]`).
- Agent Builder first, grounded in our indices. Fallback: OpenAI from the api with retrieved chunks, still grounded in ES.
- Non-AI path everywhere: Here, people list, intro flow and leaderboard need no model (`[AI-07]`).
- Validate every model output against a TypeScript interface; retry once; human-friendly error (`[AI-08]`). Cache quizzes, whys and icebreakers; pre-generate for every seeded talk at seed time (`[AI-11]`).

## 9. Glossary

- **XP event:** one row in the ledger: `{attendee, type: check_in | quiz | handshake | welcome | badge, xp, talkId?, locationId?, at}`. Presence is the latest `check_in` per attendee.
- **Hallway / Intro:** a mutual opt-in meeting with a slot, a meeting point, an icebreaker and arrivals. Statuses: proposed, accepted, declined, met.
- **Verified handshake:** both parties scanned the same meeting point within 30 minutes. The only way `met` is reached.
- **Meeting point / booth / room:** kinds of `location`, each with a `geo_point` and a QR.
- **Signed token:** HMAC over `locationId` (printed) or `locationId + exp` (screen). Forged or expired scans are rejected.
- **Agent Builder:** Elastic's hosted agent, grounded in our indices; our model layer. **Workflow:** Elastic's event-driven automation; fires badges.
- **Hybrid / RRF / `semantic_text` / Jina:** keyword + vector search fused by rank; `semantic_text` embeds via an inference endpoint; Jina is the embedding model Elastic offered.
- **cnh-starter:** Radar's template; `git push` → Argo CD → `team-<name>` namespace; the Service named `app` on port 80 is routed to `https://<team>.cnh.radarhq.io`.
- **Semantic conventions:** OTel's standard attribute names; our custom ones live under `kubequest.*`.

## 10. Open questions

- **Stack:** Angular (this repo's rules) unless Collin prefers Next.js for the UI lane. Decide before the first UI commit; the rule files swap in five minutes.
- **Jina model IDs and whether Agent Builder and Workflows are enabled on the Serverless trial:** ask Sophia at 11:45. Fallbacks are in section 8 and the badges bullet.
- **Join code and team name** from the Radar table. Team name = `kubequest` unless taken.
- **Record the Kelsey panel?** Ask the organizers before 2:00.
- **Presentation slot length:** plan for 3 minutes with a 90-second cut.
- **Repo:** create `kubequest` from the cnh-starter template (public), copy `brief/`, `plans/`, `rules/`, `prompts/` and our `AGENTS.md` index in, and add both of us as collaborators. The old `11-9-hackathon` repo is planning only.
