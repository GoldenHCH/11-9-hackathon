# General Plan

> **Status (14:50 MST):** PR 5, "KubeQuest backend v1", replaced the Hallway design with the game in `knowledge-graph/game-design.md`, and PR 16 replaced the campfire double-scan with a phone-to-phone handshake (`phase-06-handshake-booth-notes.md`). Where the brief's mechanics differ from those two documents and `docs/api.md`, the game design and the API win (`AGENTS.md`). The per-phase files carry their own status notes.
>
> **Where we are (14:50 MST):** checked against `origin/main` (`69d5f47`), `gh pr list`, the worktrees and the live URL (`/healthz` reports `0110194`, the PR 16 merge).
> - **Merged since 14:10:** PR 13 (plan owners, Phase 05 plan), PR 14 (per-purpose AI time budget under the 15 s gateway limit; the app's key now reaches Agent Builder), PR 15 (Gitar's three PR 5 findings, plus the banner Workflow date), PR 16 (handshakes, booth notes, messages, recap: 9 new tools and 8 screens), PR 6 (landing page), PR 8 (sponsor docs), PR 11 (previous plan update).
> - **Live now:** 32 tools. Dash0 receives traces from the collector (`docs/sponsor-tools.md`). The demo boss reads `fighting` at 10/10 on the real clock (`boss_state` for `cloud-native-hackathon`). `organizer_stats` returns 63 players and 192 check-ins today.
> - **Critical path: Phase 03.** On `main`, `/signup`, `/here` (Now + boss bar), `/quiz/:talkId`, `/quests`, `/board`, `/organizer` and `/screen/:locationId` are still `placeholder` routes, and every one is on the demo path. No Phase 03 branch or PR is on GitHub (Collin's local work not checked). Built by PR 16: `/r/:locationId` (scan landing), `/meets`, `/intro/:id`, `/code`, `/handshake/:id`, `/notes`, `/recap`, `/me/:attendeeId`.
> - **In flight, Golden:** `feat/role-views-booths` (`phase-07-roles-booths.md`, see the table). Local only, branched from `5e290cb` (PR 12): 21 of its changed files also changed on `main` since (types, `tools/index.ts`, `security/tokens.ts`, `docs/api.md`, `app.routes.ts`, the plans), and its routes predate PR 16's. Merge `main` into it before the PR, and take `main`'s side for `plans/`.
> - **Close:** PR 9 (signed check-in) has an empty diff against `main`.
> - **Decided:** leave `DEMO_NOW` unset. The demo boss fights on the real clock, and `DEMO_NOW=2026-11-10T09:00` would make it read `escaped`. `whats_next` and `recommend_talks` stay empty on the live app; demo the itinerary from fixtures or skip it.
> - **No owner:** `GITHUB_TOKEN` (`app/src/profile/github.ts` calls GitHub with no token), the broken `index-all` bundle (`scripts/seed.ts` still resolves `resources/` from `__dirname`), Gitar auto-apply, `main` branch protection (`protected: false`, re-checked 14:47), browser RUM (`/api/config` has no `rum` and no `traceUrlTemplate`).

**Team:** two people. **Golden** owns the product lane (Elastic, tools, game loop, quests, meets, booths). **Collin** owns the platform lane (cnh-starter, Argo CD, OTel Collector, Gitar, Radar log), the UI, and Dash0 (dashboard + SLO, browser RUM). Each runs their own Claude Code session on their own phase branch; the lanes never touch the same folders. Collin's order: Phase 03 sections 0–5 before anything else. Golden's order: the incident and the boss check (`phase-05-widen.md`), then `feat/role-views-booths` cut to the booth directory and the admin page.

**Demo path (one sentence):** Judges scan the QR on the demo screen → sign up and get a first quest → quiz on this morning's kickoff talk knocks down the boss bar → two judges accept a meet, one shows `/code`, the other scans it, both answer the same question → "You met", +50 XP each, the Connectors board moves → open that XP event's trace in Dash0 → the incident: Radar investigation → Agent0 → Gitar-reviewed fix PR → Argo CD → green.

**Stack:** cnh-starter (Argo CD, GHCR, `team-<name>` namespace, `https://<team>.cnh.radarhq.io`) · one Node image: Express API in `app/` serving the Angular build, `/healthz` and `/readyz` on `$PORT` 8080 · OTel Collector Deployment with committed config · Elasticsearch on Elastic Cloud Serverless (Jina `semantic_text`, RRF, geo, Agent Builder, Workflows) · Agent Builder agent `kubequest-writer` as the model layer, with deterministic fallbacks (OpenAI fallback not built) · GitHub Actions (from the starter) + Gitar · Radar Cloud + MCP · Dash0 + MCP + Agent0. **No second datastore.** Angular unless Collin picks Next.js before the first UI commit.

**Architecture rule:** the tools module (`app/src/tools/`, the 32 tools in `docs/api.md`: `sign_up`, `get_profile`, `update_settings`, `check_in`, `screen_token`, `whats_around_me`, `whats_next`, `search`, `recommend_talks`, `recommend_people`, `quest_board`, `respond_quest`, `make_quest`, `quiz_for_talk`, `submit_quiz`, `boss_state`, `propose_meet`, `respond_meet`, `list_meets`, `leaderboard`, `inventory`, `world`, `organizer_stats` from PR 5, and `handshake_code`, `start_handshake`, `handshake_state`, `answer_handshake`, `save_booth_note`, `list_booth_notes`, `send_message`, `list_messages`, `recap` from PR 16) is the only way anything touches data. UI routes, the assistant, the MCP server and the CronJob all call it. No model inside a tool; every tool emits a span.

**Repo layout (cnh-starter plus ours):**

```
app/            Express API + tools/ + ai/ + es/ + otel; serves web/dist   (starter's app/)
web/            Angular app (built into app/public at image build)
shared/         Phase 01 types; the backend's own types now live in app/src/types/
scripts/        setup.sh, local-cluster.sh (starter) + ingest-talks, seed, index-all, nudge
resources/      sessions.json, locations.json, transcripts/, attendees.seed.json, fixtures/
deploy/         deployment.yaml, kustomization.yaml, httproute.yaml (starter) + otel-collector.yaml, collector-config.yaml, cronjob-nudge.yaml
argocd/         application.yaml (starter)
.gitar/         review/ instructions, rules/ (ai-disclosure, game-integrity), config/apply.md
docs/           api.md (the UI contract), architecture.md, elastic.md, ops.md, ops-ai.md, ops-xp.md, radar-log.md
brief/ plans/ rules/ prompts/   this kit
```

## Clock (MT)

| Time | Golden (product) | Collin (platform → UI) |
|------|------------------|------------------------|
| 11:30–11:50 | Elastic Serverless project; inference endpoint (Jina if offered, E5 otherwise); start Phase 01 in a local folder | Create `kube-quest` from cnh-starter (public), copy the kit in, add Golden; join code at the Radar table; `scripts/setup.sh kubequest`; GHCR package public; apply `argocd/application.yaml` via Radar MCP. **Hello app live by 12:00** |
| 11:45 | Ask Sophia: Jina model ids, Agent Builder, Workflows on the trial | Install Gitar, write `.gitar/review/`, throwaway PR to confirm it comments |
| 11:50–12:40 | **Phase 01:** types, five indices, ingest talks, locations, seed, tool signatures + stubs, check-in **v1 (unsigned, on purpose)**. PR → Gitar | **Phase 04:** OTel Collector + config, SDK in `app/`, JSON logs with trace ids, RUM, `docs/radar-log.md` first entry. PR → Gitar |
| 12:40–13:00 | **Phase 02 starts:** signed tokens (v2, the Gitar security story), XP ledger, leaderboard agg, `recommend_people` hybrid + nearby | **Phase 03 starts:** signup, Here, leaderboard on fixtures |
| 13:00–14:30 | Lunch + Kelsey panel (record if permitted). Agents keep going. Merge PRs | Same |
| 14:30–15:30 | Done by 14:50: Gitar's PR 5 findings (PR 15), handshakes and booth notes (PR 16), AI time budget (PR 14). **Now:** merge `main` into `feat/role-views-booths` and land it cut to the booth directory + admin page (`phase-07-roles-booths.md`); close PR 9 | **Phase 03 sections 0–5** (`phase-03-ui.md`): wiring, signup, Now and boss bar, quiz, quests, board and demo screen. These are the critical path: all are placeholders on `main` |
| 15:30–16:30 | **Phase 05** (`phase-05-widen.md`): the incident (Radar investigation + fix PR; the `index-all` bundle is one candidate); keep the boss fightable for the demo; assistant + MCP; nudge CronJob and quests near you only if green | Finish Phase 03 sections 0–5 first. Then sections 6–9 only if green: search, live tools and RUM, accessible pass (section 7, organizer, moves to Phase 07's `/admin`). Dash0 dashboard + SLO, and Agent0 for the incident. QR sheet from `scripts/print-qr-links.ts`; redeploys gated on Radar checks, each logged |
| 16:30–17:00 | **Last mile:** audit vs. brief, README with sponsor sections + AI disclosure, screenshots | Backup screen recording, polish, trim the kickoff transcript check |
| 17:00–17:15 | Register team (both names), submit for all five tracks. Rehearse twice on two phones | Same |

## Phases

| # | Phase | Blocking? | Parallel with | Owner | Plan file | Status |
|---|-------|-----------|---------------|-------|-----------|--------|
| 00 | Repo from cnh-starter, kit copied in, hello app live through Argo CD | **Yes (platform)** | 01 | Collin | in `phase-04-ops.md` | Done |
| 01 | Types, five indices, ingest talks + locations, seed, tool signatures + stubs, check-in v1 | **Yes (product)** | 00, 04 | Golden | `phase-01-data.md` | Done (PR 3), reshaped by PR 5; `index-all` bundle still broken (both bugs are still in `scripts/seed.ts` on `main`), no owner |
| 04 | OTel Collector + config, SDK, logs↔traces, RUM, Gitar config, radar-log | No | 01 | Collin | `phase-04-ops.md` | Mostly done. Dash0 keys and traces live. Open: RUM (Collin); Gitar auto-apply, `main` protection, `GITHUB_TOKEN` (no owner) |
| 02 | Tools for real: signed check-in, XP with trace ids, leaderboards, hybrid people match, quests, meets, boss rooms, quiz, banners | No | 03 | Golden | `phase-02-tools.md` | Done: PR 5, PR 10 (Agent Builder model), PR 12 (people here), PR 14 (AI time budget), PR 15 (Gitar findings). `DEMO_NOW` decided: unset. Left: `peopleHere` in `docs/api.md` and the `check_in` fixture. Close PR 9 (empty) |
| 03 | Angular UI against `docs/api.md`, fixtures first then live; accessible mode | **Yes (demo)** | 05, 07 | Collin | `phase-03-ui.md` | **Critical path.** Signup, Now + boss bar, quiz, quests, board, demo screen are placeholders on `main`. PR 16 built the scan landing, meets and Me link |
| 05 | Widen in order: the incident, Dash0 dashboard + SLO, assistant + MCP, nudge CronJob, quests near you, crafting | No | split | both | `phase-05-widen.md` | Not started. Dash0 no longer blocks it; boss checked fightable at 14:47 |
| 06 | Phone-to-phone handshakes, booth notes, messages, recap | No | — | Collin | `phase-06-handshake-booth-notes.md` | Merged as PR 16, live. Two-phone checks in its "Done when" not run yet |
| 07 | Role views (attendee, exhibitor, organizer) and a page per booth | No | 03, 05 | Golden | `phase-07-roles-booths.md` (on `feat/role-views-booths` as `phase-05-roles-booths.md`; rename when it merges `main`) | In progress, local, 21 files to reconcile with `main`. Cut to the booth directory + `/admin` (replaces Phase 03 section 7) |
| 08 | Last mile: audit, README, screenshots, backup video, submit at 5:15 | — | — | both | — | Not started |

Phase 01 fixed the first types, mappings, seed and fixtures; PR 5 replaced them with the backend that `docs/api.md` describes, and Phase 03 now builds against that contract and its fixtures. Phase 04 needs only the starter's hello app; it instruments the tool boundary by name.

## Requirements from the brief

- "The main coding and design work must begin after the hackathon starts."
- "Every submission needs a public source-code repository and a README with setup instructions."
- "AI coding assistants are allowed, but their use must be disclosed."
- "You have to understand the code you submit and be able to explain the project architecture."
- "Use only data, tools and accounts you own or have permission to use." No private or personal data in the repo or demo; only the trimmed sponsor-talk transcript may be committed.
- Register the team with both names before the one submission. Submit for Sonar, Dash0, Radar, Elastic and Merge Forward.
- Every track: "Makes conferences easier."
- Elastic: "core data layer, not a side feature"; "smart use of keyword, semantic, vector, or hybrid search"; Sophia: depth and creativity, Jina, Agent Builder, Workflows, geo, Serverless.
- Dash0: "traces, logs, metrics, and real-user monitoring"; "Agent0 or the MCP server to find and fix something real during the day, shown in the demo"; "observability is part of the product experience"; bonus dashboard or SLO; Evgeny: semantic conventions, collector configs, logs correlated with traces.
- Radar: "runs on Kubernetes with Radar connected"; "Radar's UI and MCP while building or operating"; "AI investigations on a real issue"; Roy: meaningful decisions Radar helped with.
- Sonar: "Gitar is part of how you built, with features landing through PRs it reviewed"; "project-aware setup, with review instructions and repository rules"; "CI failure diagnosis and auto-apply to fix real problems".
- Merge Forward: inclusive and accessible.
- Submissions close 5:30 PM MT; ours 5:15.

## Cut on purpose

- **Order if behind:** crafting → quests near you → nudge CronJob → assistant + MCP → the exhibitor dashboard (Phase 07; keep the booth directory and `/admin`) → the "Also here" card on the scan result (its backend merged as PR 12) → connectors and questers boards (keep overall) → quiz for non-seeded talks. **Never cut:** signed check-in + XP with trace ids + leaderboard + signup with first quest + people match + boss bar + verified meet by handshake + collector + Gitar PRs + Argo/Radar.
- **Hardware smart badges, live transcription:** roadmap slide.
- **Luma, LinkedIn, X:** no usable APIs today.
- **Passwords, OAuth:** a personal link is enough for one day.
- **Indoor routing, websockets, live schedule sync, a second datastore, a chat thread:** none moves a rubric line.
- **Hand-written Kubernetes manifests and a Render fallback:** the starter and the team URL replace both.
- **Staged incident:** only if nothing real breaks by 3:30, and say so in the demo. Judges asked for a real issue.
