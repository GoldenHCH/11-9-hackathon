# General Plan

**Team:** two people. **Golden** owns the product lane (Elastic, tools, game loop, Hallway). **Collin** owns the platform lane (cnh-starter, Argo CD, OTel Collector, Gitar, Radar log) and then the UI. Each runs their own Claude Code session on their own phase branch; the lanes never touch the same folders.

**Demo path (one sentence):** Judges check in from a QR on the screen → XP on the leaderboard → quiz from this morning's kickoff talk → two judges matched by Hallway, both tap "Let's meet", meet at Point A, shake hands, 50 XP and a badge → click the XP event and open its trace in Dash0 → the incident: Radar investigation → Agent0 → Gitar-reviewed fix PR → Argo CD → green.

**Stack:** cnh-starter (Argo CD, GHCR, `team-<name>` namespace, `https://<team>.cnh.radarhq.io`) · one Node image: Express API in `app/` serving the Angular build, `/healthz` and `/readyz` on `$PORT` 8080 · OTel Collector Deployment with committed config · Elasticsearch on Elastic Cloud Serverless (Jina `semantic_text`, RRF, geo, Agent Builder, Workflows) · OpenAI as model fallback · GitHub Actions (from the starter) + Gitar · Radar Cloud + MCP · Dash0 + MCP + Agent0. **No second datastore.** Angular unless Collin picks Next.js before the first UI commit.

**Architecture rule:** the tools module (`check_in`, `recommend_talks`, `recommend_people`, `whats_around_me`, `whats_next`, `propose_intro`, `respond_intro`, `quiz_for_talk`, `submit_quiz`, `leaderboard`) is the only way anything touches data. UI routes, the assistant, the MCP server and the CronJob all call it. No model inside a tool; every tool emits a span.

**Repo layout (cnh-starter plus ours):**

```
app/            Express API + tools/ + ai/ + es/ + otel; serves web/dist   (starter's app/)
web/            Angular app (built into app/public at image build)
shared/         types only
scripts/        setup.sh, local-cluster.sh (starter) + ingest-talks, seed, index-all, nudge
resources/      sessions.json, locations.json, transcripts/, attendees.seed.json, fixtures/
deploy/         deployment.yaml, kustomization.yaml, httproute.yaml (starter) + otel-collector.yaml, collector-config.yaml, cronjob-nudge.yaml
argocd/         application.yaml (starter)
.gitar/review/  review instructions + repo rules
docs/           radar-log.md, ops.md
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
| 14:30–15:30 | Intros (slot rule, `geo_distance` meeting point), Agent Builder: quiz + icebreaker, badges (Workflow or api) | Quiz, people, intro, organizer screens; wire to real tools; accessible mode pass |
| 15:30–16:30 | Dash0 dashboard + SLO; the incident (Agent0 + Radar investigation + fix PR); assistant/MCP only if green | Keyboard-only run; mobile; QR sheet printed; redeploys gated on Radar checks, each logged |
| 16:30–17:00 | **Last mile:** audit vs. brief, README with sponsor sections + AI disclosure, screenshots | Backup screen recording, polish, trim the kickoff transcript check |
| 17:00–17:15 | Register team (both names), submit for all five tracks. Rehearse twice on two phones | Same |

## Phases

| # | Phase | Blocking? | Parallel with | Owner | Plan file | Status |
|---|-------|-----------|---------------|-------|-----------|--------|
| 00 | Repo from cnh-starter, kit copied in, hello app live through Argo CD | **Yes (platform)** | 01 | Collin | in `phase-04-ops.md` | |
| 01 | Types, five indices, ingest talks + locations, seed, tool signatures + stubs, check-in v1 | **Yes (product)** | 00, 04 | Golden | `phase-01-data.md` | |
| 04 | OTel Collector + config, SDK, logs↔traces, RUM, Gitar config, radar-log | No | 01 | Collin | `phase-04-ops.md` | |
| 02 | Tools for real: signed check-in v2, XP, leaderboard, hybrid people match, Intros + geo + slot rule, Agent Builder quiz/why/icebreaker, badges | No | 03 | Golden | `phase-02-tools.md` | |
| 03 | Angular UI on fixtures then real tools; accessible mode | No | 02 | Collin | `phase-03-ui.md` | |
| 05 | Widen in order: organizer view + Dash0 dashboard/SLO, the incident, assistant + MCP, nudge CronJob, quests near you, crafting | No | split | both | `phase-05-widen.md` | |
| 06 | Last mile: audit, README, screenshots, backup video, submit at 5:15 | — | — | both | — | |

Phase 01 fixes the types, mappings, seed, fixtures and tool signatures; 02 and 03 depend only on those. Phase 03 builds against `resources/fixtures/` until 02 merges. Phase 04 needs only the starter's hello app; it instruments the tool boundary by name.

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

- **Order if behind:** crafting → quests near you → nudge CronJob → assistant + MCP → Workflow badges (compute in api) → Intro slot + meeting point (keep mutual scan) → quiz for non-seeded talks. **Never cut:** signed check-in + XP + leaderboard + GitHub profile + people match + verified handshake + collector + Gitar PRs + Argo/Radar.
- **Smart badges, booths, live transcription:** roadmap slide.
- **Luma, LinkedIn, X:** no usable APIs today.
- **Passwords, OAuth:** a personal link is enough for one day.
- **Indoor routing, websockets, live schedule sync, a second datastore, a chat thread:** none moves a rubric line.
- **Hand-written Kubernetes manifests and a Render fallback:** the starter and the team URL replace both.
- **Staged incident:** only if nothing real breaks by 3:30, and say so in the demo. Judges asked for a real issue.
