# Phase 01 — Types, Elasticsearch, data, tool skeleton

**Goal:** five Elasticsearch indices full of real talks, seeded attendees, locations with geo points and QR tokens, and a tool module with fixed signatures and stubbed bodies that Phases 02 and 03 build against. Check-in lands in its deliberately simple v1 so Gitar has something real to catch.
**Brief requirements covered:** Elastic core data layer; no personal data (seeded attendees); the Gitar security story's first half.
**Depends on:** Collin's Phase 00 (repo from cnh-starter) for the push target. Start in a local folder and push the moment the repo exists.
**Owner:** Golden. **Budget:** 11:50–12:40.
**Rules to load:** `rules/hackathon.md`, `rules/typescript.md`, `rules/ai.md`.

## Before you code

- [ ] Elastic Cloud Serverless project; endpoint URL + API key to Collin for the `app-credentials` Secret
- [ ] Inference endpoint: Jina embeddings if Sophia confirms the model id at 11:45, otherwise `.multilingual-e5-small`. Record the choice in `docs/ops.md`
- [ ] Ask Sophia whether Agent Builder and Workflows are enabled on the trial

## Checklist

### Layout (5 min) — inside the starter

- [ ] `app/` stays the starter's Node service: add Express + TypeScript (`tsx` dev), `/healthz`, `/readyz`, `$PORT` 8080, static serving of `web/dist` from `app/public`
- [ ] `shared/` (types), `web/` (Angular, SCSS, Material, routing; starter template deleted), `scripts/`, `resources/`; npm workspaces at the root with `dev`, `build`, `lint`, `typecheck`
- [ ] Update the starter `Dockerfile` to build `web/` then `app/`. Keep `deploy/` and `argocd/` as Collin left them
- [ ] `.env.example` with every variable and a one-line comment; `.env` gitignored
- [ ] `README.md`: name, pitch, setup, **AI assistance disclosure**, sponsor sections as headings to fill

### Shared types (5 min) — `shared/src/`

- [ ] `Session`: id, title, abstract, speakers[], start, end, venue, level, track, locationId, url, hasTranscript
- [ ] `Location`: id, name, kind (`room` | `meeting-point` | `booth`), venue, floor, geo `{lat, lon}`, token
- [ ] `Profile`: topics[], seniority, goals[], offers[], asks[], languages[], firstTimer, welcomer
- [ ] `Attendee`: id, handle, name, githubLogin?, avatarUrl?, headline, profileText, profile, lastLocation? `{lat, lon}`, lastLocationId?, lastSeenAt?, visible, xp, badges[], createdAt
- [ ] `XpEvent`: id, attendeeId, type (`check_in` | `quiz` | `handshake` | `welcome` | `badge`), xp, talkId?, locationId?, introId?, at
- [ ] `Intro`: id, fromId, toId, status (`proposed` | `accepted` | `declined` | `met`), proposedAt, slot? `{start, end}`, meetingPointId?, icebreaker?, arrivals: `{attendeeId, at}[]`
- [ ] `Quiz`: talkId, questions: `{q, choices[4], answer}[]`, source (`transcript` | `abstract`)
- [ ] `PersonMatch`, `TalkMatch`, and input/output types for every tool below

### Elasticsearch (10 min) — `app/src/es/`

- [ ] `talks`: `title` text, `abstract` text, `searchText` semantic_text, `transcript` semantic_text (chunks, seeded talks only), `track`/`level`/`locationId`/`venue` keyword, `start`/`end` date, `geo` geo_point (copied from the location)
- [ ] `attendees`: `profileText` semantic_text, `headline` text, `profile.topics` keyword, `profile.firstTimer`/`profile.welcomer`/`visible` boolean, `lastLocation` geo_point, `lastLocationId` keyword, `lastSeenAt` date, `xp` integer, `badges` keyword
- [ ] `locations`: `kind`/`venue` keyword, `floor` keyword, `geo` geo_point
- [ ] `xp_events`: `attendeeId`/`type`/`talkId`/`locationId`/`introId` keyword, `xp` integer, `at` date
- [ ] `intros`: `fromId`/`toId`/`status`/`meetingPointId` keyword, `proposedAt`/`slot.start`/`slot.end` date, `arrivals` nested
- [ ] `ensureIndices()` idempotent on startup. Every ES call sets a timeout; user input never goes into scripts (this is one of Gitar's rules)

### Ingest talks (10 min) — `scripts/ingest-talks.ts`

- [ ] Fetch the schedule page with a browser User-Agent; parse the `application/ld+json` blocks; take `subEvent[]` (300 sessions verified 10:20)
- [ ] Split `location.name` on ` | ` → venue, floor, room; slugify → `locationId`
- [ ] `track` by keyword table on the title (ai, security, networking, observability, platform, storage, other); `level` by rules (101/intro → 1, deep dive/internals → 3, else 2). No model
- [ ] Write `resources/sessions.json` (committed) so nothing depends on the live page

### Locations + QR tokens (10 min) — `scripts/build-locations.ts`

- [ ] Distinct rooms → `resources/locations.json` with hand-placed relative `geo` (Salt Palace around 0,0; Hyatt offset so `geo_distance` reflects the 10-minute walk), plus 3–4 meeting points and 2–3 booths
- [ ] Signed static token per location = HMAC-SHA256(`locationId`, `QR_SECRET`) base64url. **v1 check-in ignores it** (below). Collin's QR sheet uses `/r/<locationId>?t=<token>`
- [ ] Seeded transcripts: `resources/transcripts/<talkId>.md` for the trimmed kickoff sponsor talks only. **Never the raw recording.** Chunk into ~500-token pieces at index time

### Seed (10 min) — `scripts/seed-attendees.ts`

- [ ] ~150 clearly fake attendees generated once with a model (JSON validated against `Attendee`): real-sounding names, GitHub-style handles and headlines, 2–3 sentence `profileText`, topics drawn from talk titles, ~20% `firstTimer`, ~15% `welcomer`, 4–5 languages. Commit `resources/attendees.seed.json`
- [ ] Seeded check-ins across rooms running "now" (`SEED_NOW` env so the demo can be pinned), XP events to match, ~10 intros across all statuses, a few badges
- [ ] Two named demo personas, each other's top match: a platform engineer whose upgrades keep breaking, and a first-timer frontend dev curious about Kubernetes

### Index all (5 min) — `scripts/index-all.ts`

- [ ] Bulk-index everything; fixed ids; idempotent; prints counts; config from env only so it can run as a one-shot Job

### Tool module (10 min) — `app/src/tools/`

- [ ] Signatures and JSON-schema descriptions in one `tools/index.ts` export (Phase 02 hands the same object to the assistant and the MCP server):
  - `check_in({ attendeeId, locationId, token? })` → `{ location, xp, event }` — **v1: trusts `locationId`, ignores `token`.** This is deliberate; leave a TODO-free, comment-free simple implementation and let the PR review catch it
  - `recommend_talks({ attendeeId, day?, limit? })` → `TalkMatch[]`
  - `recommend_people({ attendeeId, hereOnly?, limit? })` → `PersonMatch[]`
  - `whats_around_me({ attendeeId })` → `{ location, sessionsNowHere, sessionsNextHere, peopleHere }`
  - `whats_next({ attendeeId })` → `{ session, startsInMinutes, walkMinutes }`
  - `propose_intro({ fromId, toId })` → `Intro`
  - `respond_intro({ introId, attendeeId, response: 'accept' | 'decline' })` → `Intro`
  - `quiz_for_talk({ talkId })` → `Quiz`
  - `submit_quiz({ attendeeId, talkId, answers })` → `{ correct, xp }`
  - `leaderboard({ limit? })` → `{ handle, xp, badges }[]`
- [ ] Stub bodies read `resources/*.json`; `POST /api/tools/:name` runs a tool; every tool wrapped in a span named `tool.<name>` with `kubequest.*` attributes (Collin's SDK setup will pick these up)
- [ ] `resources/fixtures/<tool>.json`, one response each, for Phase 03

## Done when

- [ ] Scaffold with `/healthz`, `/readyz` and root npm scripts pushed within 15 minutes of the repo existing
- [ ] `npm run dev` runs api + web; `/healthz` reports ES reachable and five index counts
- [ ] `POST /api/tools/whats_around_me` for a demo persona returns a room, sessions and people from the seed
- [ ] A hybrid query against `attendees` for "eBPF and platform engineering" returns sensible people (curl sanity check)
- [ ] PR `phase-01-data` opened; Gitar review visible; if Gitar flags the unsigned check-in, screenshot it (that's the security story's first frame)
