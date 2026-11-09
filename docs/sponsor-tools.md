# How we used the sponsor tools

KubeQuest is built on four sponsor tools. For each one, this file says what we used, why, how it helped, and what is still missing. It is honest on purpose: the "not yet" lines are the to-do list before the 5:15 submission.

| Tool | Role in KubeQuest | Status |
|------|-------------------|--------|
| **Elastic** (Serverless) | The only datastore and the search/matching engine | Live. Jina embeddings + Jina reranker, a grounded Agent Builder agent, a banner Workflow |
| **Dash0** | Traces, metrics and logs for every XP point | Live. The cluster collector exports to Dash0 |
| **Radar** | Our Kubernetes cluster, GitOps deploys, secrets, health | Live. Checks and an AI investigation still to do |
| **Gitar** (Sonar) | AI review on every PR, with project rules | Live. Its PR #5 findings still need fixing |

---

## Elastic: the data layer and the game's brain

**What we use**
- **Elasticsearch Serverless is the only datastore.** Nine indices: `talks`, `attendees`, `locations`, `xp_events`, `intros`, `quests`, `handshakes`, `booth_notes`, `messages`. No second database.
- **Jina embeddings through `semantic_text`** (`.jina-embeddings-v5-text-small`) on talk text and player profiles.
- **Hybrid search with RRF, reranked by Jina.** `search`, `recommend_talks` and `recommend_people` combine a semantic retriever with a keyword `multi_match` through the `rrf` retriever. A `text_similarity_reranker` on `.jina-reranker-v3` then rescores the top 20 (about 150 ms more). If the reranker fails, the app falls back to plain RRF, then to keyword search. A search for "cheaper GPUs" finds the on-prem cluster-allocation talk even though neither word is in its title.
- **Geo.** Every room, booth and campfire has a `geo_point`. The meet flow sorts campfires by `geo_distance` from the midpoint of both players. "Near me" filters by distance.
- **Aggregations** for the three leaderboards, the boss room's shared health bar (correct answers counted live), room busyness (check-ins in the last 20 minutes) and the organizer's meet funnel.
- **Real conference data.** 26 Tuesday sessions from the official KubeCon NA 2026 schedule, the Salt Palace and Hyatt venue, 6 campfires and the sponsor booths.

**Why:** the game is about finding the right talk, booth or person, and that is a search problem. Keyword, semantic and geo search live in one engine, so matching is one query instead of glue code across services.

**How it helped:** people matching, talk recommendations and "nearest campfire to both of you" are single queries. The two demo players rank each other first purely from what they typed at signup.

**Agent Builder: a grounded agent, not a prompt proxy.** Agent `kubequest-writer` has two custom ES|QL tools over our own indices. `kubequest.upcoming_talks` does a Jina semantic `MATCH` on talks after a given time, then ES|QL `RERANK` with the Jina reranker. `kubequest.people_like` returns public profile fields only. Live in the app: **Ask the guide** on the Here page (`ask_guide` tool). The agent calls the talks tool, and the app checks every talk id it returns against the index before showing it. If the agent takes longer than 10 s, the reranked picks show first and the agent's grounded picks replace them when they arrive. The same agent wrote the validated 3-question quizzes for the talks, which are stored on each talk so the demo never waits on a model. Every model call has a per-purpose time budget, and a call that runs out of budget is aborted, not left running. The app's API key has `feature_agentBuilder.all`.

**Workflows.** `kubequest-banners` (`resources/workflows/banners.yaml`) runs in Kibana. It aggregates a player's XP ledger and appends each banner reached to the profile with an idempotent script. It leaves `xp_events` to the app's `awardXp`, the only ledger writer, so the Workflow and the app can award the same banner in either order without double-awarding.

**Not yet**
- The agent's answer takes about 15 s, so the guide shows reranked picks first. A faster model or a streaming response would close that gap.

---

## Dash0: every point is traceable

**What we use**
- **The OpenTelemetry Node SDK** in the app (`app/src/otel.ts`, loaded before anything else) for traces, metrics and logs.
- **A span per tool** (`tool.<name>`) with our own attributes under `kubequest.*`: tool, location, talk, meet, XP awarded and rejection reason. Standard `http.*` and Elasticsearch spans come from auto-instrumentation.
- **Metrics:** `kubequest.xp.awarded` (by type), `kubequest.checkins` (by location), `kubequest.handshakes`, `kubequest.quiz.duration`.
- **JSON logs carrying `trace_id` and `span_id`,** so logs and traces line up.
- **Every XP event stores its `traceId` in Elasticsearch.** Each leaderboard row carries its latest one, so the UI can open the trace behind any point.
- **An in-cluster OpenTelemetry Collector** whose config is in git (`deploy/otel-collector.yaml`): `memory_limiter`, `batch` and resource attributes, exporting to Dash0.

**Why:** the brief's line is "observability is part of the product experience." Clicking a leaderboard entry and seeing web → API → Elasticsearch for that one point turns observability into a game feature.

**How it helped:** the trace on each XP event already answers "why did this player get 50 XP?" from the data, before Dash0 is even connected.

**Status:** live. The Dash0 token, endpoint and dataset are in `app-credentials`. The collector restarted cleanly, and spans from the cluster (HTTP, Elasticsearch, `tool.*`) show in Dash0's trace explorer.

**Not yet**
- **Real-user monitoring** in the browser (UI work), a Dash0 dashboard and SLO (check-in p95 < 500 ms), and using Agent0 or the Dash0 MCP to find and fix something real.

---

## Radar: the cluster and how we operate it

**What we use**
- **Our own vcluster `kube-quest`** (namespace `team-kube-quest`), public at https://kube-quest.cnh.radarhq.io.
- **GitOps through Argo CD:** merge to `main` → GitHub Action builds the image → deploy commit → Argo CD syncs `deploy/`. That's the app, its Service and the OpenTelemetry Collector.
- **The Radar Cloud UI** to apply the Argo CD Application, after reviewing its server-side dry-run diff.
- **The Radar MCP server from Claude Code** to create and extend the `app-credentials` Secret outside git, sync Argo CD, and check rollout health, pod logs and events.

**Why:** the brief asks for an app on Kubernetes operated with Radar's UI and MCP. GitOps keeps every change reviewable, and Radar lets the agents see the cluster without anyone handling a kubeconfig.

**How it helped**
- **Our first cluster failed to provision.** Radar's join status page showed it plainly, so we recreated the team as `kube-quest` instead of debugging our own app.
- **After the backend merge, Radar confirmed the release:** Synced to `2c06711`, 2/2 app pods Ready on image `79c99a0`, the collector Ready and no quota errors.
- **Radar's pod logs found the Dash0 problem:** "invalid authentication token starting with 'missing'". We didn't have to guess.

Step-by-step history: [`radar-log.md`](radar-log.md).

**Not yet**
- The "before" and "after" of Radar Checks on `team-kube-quest`.
- One AI investigation on a real symptom (the Dash0 export failure is a good candidate).
- The 5:30 demo story.

---

## Gitar: review on every change

**What we use**
- **Gitar is installed on the repo,** and changes land through PRs it reviews.
- **Project-aware setup in `.gitar/`:** review instructions (`review/conventions.md`, `review/security.md`), repository rules (`rules/game-integrity.md`, `rules/ai-disclosure.md`) and auto-apply criteria (`config/apply.md`).
- **Our rules encode the game's integrity:** check-ins need signed tokens, `awardXp` is the only writer to `xp_events`, no photo or "how to spot me" before both players accept, every Elasticsearch call has a timeout, and no model inside `app/src/tools/`.

**Why:** many agents are writing code fast. A reviewer that knows our rules catches what a rushed human skim misses.

**How it helped: real findings.**
- **On PR #3** (phase 01 skeleton) Gitar flagged three bugs:
  - `check_in` awarded 10 XP on every call, with no QR token check and no dedup.
  - `quiz_for_talk` returned the correct answer to the client.
  - A presence bug.

  Backend v1 fixed all three: signed tokens, one scan per hour, and answers kept on the server.
- **On PR #5** (backend v1) Gitar flagged:
  - **Security:** the screen-token endpoint mints valid check-in tokens with no authentication, so anyone could check in to a boss room remotely.
  - **Bug:** the boss defeat bonus can pay twice when `boss_state` polls run concurrently.
  - **Rule break:** `claimQuiz` writes to `xp_events` outside `awardXp`, against our own rule 2.

**Not yet**
- **The PR #5 findings above are not fixed yet.** PR #5 was merged so the build could deploy. They are the next PR, and fixing them through Gitar's suggestions makes a good demo exhibit.
- **CI failure diagnosis and auto-apply.** The first image build after the merge failed (`npm ci`: lockfile missing the web workspace) and was fixed by hand in PR #7. Next time, let Gitar diagnose it.
- **A ruleset on `main` that requires a PR.** It needs a bypass for GitHub Actions, or the deploy commit can't land.

---

## How a deploy works

1. Open a PR. Gitar reviews it.
2. Merge to `main`.
3. The `build-and-deploy` GitHub Action builds the image (Angular web + Express API + scripts) and pushes it to GHCR as `ghcr.io/goldenhch/11-9-hackathon:<sha>`.
4. The Action commits `deploy: <sha> [skip ci]`, which bumps the tag in `deploy/kustomization.yaml`.
5. Argo CD in the cluster sees the new commit and syncs `team-kube-quest`.
6. Check it in Radar or at `https://kube-quest.cnh.radarhq.io/healthz`: the `version` should match the merged commit.

Secrets never go through git. They live in the `app-credentials` Secret, added through the Radar MCP, and the app and collector read it at pod start. After changing it, restart the pods that read it.

AI disclosure: this project was built with Claude Code, with several sessions working in parallel. Every change landed through a PR that Gitar reviewed.
