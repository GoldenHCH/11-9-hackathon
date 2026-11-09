# General Plan

> **Status (14:10 MST):** PR 5, "KubeQuest backend v1", replaced the Hallway design with the game in `knowledge-graph/game-design.md`: quests, outposts, boss rooms, meets at campfires with a match signal, levels, materials and banners, behind the 23 tools in `docs/api.md`. Where the brief's mechanics differ from those two documents, the game design and the API win (`AGENTS.md`). This file is updated to match; the per-phase files carry their own status notes.
>
> **Owners (14:10 MST):** checked against `origin/main` (`5e290cb`), `gh pr list` and the live URL (`/healthz` reports `ae5e756`, the PR 12 merge).
> - **Collin** now owns Dash0 end to end: the keys in `app-credentials`, a first trace confirmed, the dashboard + SLO, and browser RUM, alongside the UI. No Phase 03 section PR is open yet; Collin's open PRs are 6 (landing page in `frontend/`) and 8 (sponsor docs).
> - **Golden** has one branch in flight: `fix/gitar-pr5-findings` (Gitar's three PR 5 findings; local worktree, nothing pushed, no PR). The booth feature, `feat/booth-people-here`, merged as PR 12 at 14:06 and is live: `check_in` returns `peopleHere`. Its follow-ups are in the `phase-02-tools.md` status note. Next in Golden's queue, not started and with no branch: a working model on the live app, and `DEMO_NOW`.
> - **Merged since the last note:** PR 10 made the Agent Builder agent `kubequest-writer` the model layer and committed agent-written quizzes for 25 talks; PR 12 (above). **Open:** PR 11 (the previous plan update), and PR 9 (signed check-in), which is empty after merging `main` and stays open.
> - **No owner:** `GITHUB_TOKEN` (not among the Secret's keys in `knowledge-graph/platform-status.md` at 13:42, Secret not re-checked; `app/src/profile/github.ts` calls GitHub without a token either way), the broken `index-all` bundle, Gitar auto-apply, `main` branch protection (`protected: false`, re-checked).

**Team:** two people. **Golden** owns the product lane (Elastic, tools, game loop, quests and meets). **Collin** owns the platform lane (cnh-starter, Argo CD, OTel Collector, Gitar, Radar log), the UI, and Dash0 (keys, first trace, dashboard + SLO, browser RUM). Each runs their own Claude Code session on their own phase branch; the lanes never touch the same folders. Golden's order: the Gitar fixes, the booth feature (merged as PR 12), then the model and `DEMO_NOW`. Four things have no owner: `GITHUB_TOKEN`, the `index-all` bundle, Gitar auto-apply and `main` branch protection.

**Demo path (one sentence):** Judges scan the QR on the demo screen → sign up and get a first quest → quiz on this morning's kickoff talk knocks down the boss bar → two judges accept a chat quest, both phones show the same match signal, both scan the campfire → "You met", XP and a banner, the Connectors board moves → open that XP event's trace in Dash0 → the incident: Radar investigation → Agent0 → Gitar-reviewed fix PR → Argo CD → green.

**Stack:** cnh-starter (Argo CD, GHCR, `team-<name>` namespace, `https://<team>.cnh.radarhq.io`) · one Node image: Express API in `app/` serving the Angular build, `/healthz` and `/readyz` on `$PORT` 8080 · OTel Collector Deployment with committed config · Elasticsearch on Elastic Cloud Serverless (Jina `semantic_text`, RRF, geo, Agent Builder, Workflows) · OpenAI as model fallback (planned; not in `app/src/ai/` yet) · GitHub Actions (from the starter) + Gitar · Radar Cloud + MCP · Dash0 + MCP + Agent0. **No second datastore.** Angular unless Collin picks Next.js before the first UI commit.

**Architecture rule:** the tools module (`app/src/tools/`, the 23 tools in `docs/api.md`: `sign_up`, `get_profile`, `update_settings`, `check_in`, `screen_token`, `whats_around_me`, `whats_next`, `search`, `recommend_talks`, `recommend_people`, `quest_board`, `respond_quest`, `make_quest`, `quiz_for_talk`, `submit_quiz`, `boss_state`, `propose_meet`, `respond_meet`, `list_meets`, `leaderboard`, `inventory`, `world`, `organizer_stats`) is the only way anything touches data. UI routes, the assistant, the MCP server and the CronJob all call it. No model inside a tool; every tool emits a span.

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
| 14:30–15:30 | **Phase 02 leftovers** (`phase-02-tools.md` status note), in this order: `fix/gitar-pr5-findings` (one PR for Gitar's three PR 5 findings: unauthenticated screen token, boss bonus paid twice under concurrent polls, `claimQuiz` writing XP outside `award.ts`); `feat/booth-people-here` (`peopleHere` on a scan; merged as PR 12 at 14:06, with `docs/api.md` and the fixture still to update); then a working model (an Elastic key with the Kibana `agentBuilder` privilege, or an OpenAI fallback in `app/src/ai/client.ts`) and `DEMO_NOW` on the deployment | Phase 03 sections 0–5 (`phase-03-ui.md`): wiring, signup and scan, Now and boss bar, quiz, quests and meet, board and demo screen. Dash0 keys in `app-credentials` and a first trace confirmed |
| 15:30–16:30 | **Phase 05** (`phase-05-widen.md`): the incident (Radar investigation + fix PR; the `index-all` bundle is one candidate); the boss fight on at demo time; assistant + MCP only if the model works; nudge CronJob and quests near you only if green | Phase 03 sections 6–9: search, organizer, live tools and RUM, accessible pass; keyboard-only run. Dash0 dashboard + SLO, and Agent0 for the incident. QR sheet from `scripts/print-qr-links.ts`; redeploys gated on Radar checks, each logged |
| 16:30–17:00 | **Last mile:** audit vs. brief, README with sponsor sections + AI disclosure, screenshots | Backup screen recording, polish, trim the kickoff transcript check |
| 17:00–17:15 | Register team (both names), submit for all five tracks. Rehearse twice on two phones | Same |

## Phases

| # | Phase | Blocking? | Parallel with | Owner | Plan file | Status |
|---|-------|-----------|---------------|-------|-----------|--------|
| 00 | Repo from cnh-starter, kit copied in, hello app live through Argo CD | **Yes (platform)** | 01 | Collin | in `phase-04-ops.md` | Done |
| 01 | Types, five indices, ingest talks + locations, seed, tool signatures + stubs, check-in v1 | **Yes (product)** | 00, 04 | Golden | `phase-01-data.md` | Done (PR 3), reshaped by PR 5; `index-all` bundle still broken (both bugs are still in `scripts/seed.ts` on `main`), no owner |
| 04 | OTel Collector + config, SDK, logs↔traces, RUM, Gitar config, radar-log | No | 01 | Collin | `phase-04-ops.md` | Mostly done (PR 5). Collin: Dash0 keys, first trace, RUM. No owner: Gitar auto-apply, `main` protection, `GITHUB_TOKEN` |
| 02 | Tools for real: signed check-in, XP with trace ids, leaderboards, hybrid people match, quests, meets at campfires, boss rooms, quiz, banners | No | 03 | Golden | `phase-02-tools.md` | Built by PR 5; model layer moved to Agent Builder by PR 10. In flight: `fix/gitar-pr5-findings` (local, not pushed). Merged at 14:06: `feat/booth-people-here` (PR 12). Not started: a working model on the live app, `DEMO_NOW`. PR 9 (signed check-in) is empty after merging `main`, kept open |
| 03 | Angular UI against `docs/api.md`, fixtures first then live; accessible mode | No | 02 | Collin | `phase-03-ui.md` | In progress; no section PR open yet (`web/src/app` on `main` has `core`, `map` and `shared`) |
| 05 | Widen in order: the incident, Dash0 dashboard + SLO, assistant + MCP, nudge CronJob, quests near you, crafting | No | split | both | `phase-05-widen.md` | Not started. `organizer_stats`, the quest tools, `inventory` and `world` already shipped in PR 5 |
| 06 | Last mile: audit, README, screenshots, backup video, submit at 5:15 | — | — | both | — | Not started |

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

- **Order if behind:** crafting → quests near you → nudge CronJob → assistant + MCP → the "Also here" card on the scan result (its backend merged as PR 12) → connectors and questers boards (keep overall) → match-signal grid (keep the two words) → quiz for non-seeded talks. **Never cut:** signed check-in + XP with trace ids + leaderboard + signup with first quest + people match + boss bar + verified meet at a campfire + collector + Gitar PRs + Argo/Radar.
- **Hardware smart badges, live transcription:** roadmap slide.
- **Luma, LinkedIn, X:** no usable APIs today.
- **Passwords, OAuth:** a personal link is enough for one day.
- **Indoor routing, websockets, live schedule sync, a second datastore, a chat thread:** none moves a rubric line.
- **Hand-written Kubernetes manifests and a Render fallback:** the starter and the team URL replace both.
- **Staged incident:** only if nothing real breaks by 3:30, and say so in the demo. Judges asked for a real issue.
