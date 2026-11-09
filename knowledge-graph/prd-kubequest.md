# PRD: KubeQuest — Cloud Native Hackathon

Nov 9, 2026 · @Collin

> **Source:** snapshot of the live Claude Doc [PRD: KubeQuest — Cloud Native Hackathon](https://claude.ai/artifact/XS2j3JmbFNXeX3QXPqu2tm), exported at rev 15. The live doc is the version to edit. Its two embedded diagrams (architecture, build plan) are not in this copy.
>
> **Superseded where it conflicts:** this PRD was merged into `brief/brief.md`, which is the spec. The PRD's stack (Next.js, separate `web` and `api` services) differs from the current build: one Node image with an Express API serving an Angular app.

## TL;DR

Build **KubeQuest**, a conference game. Attendees earn XP for attending talks, proving they listened, visiting booths and meeting the right people. Each of the four sponsor tools does a real job in the app, so one project enters all four $4k tracks, Merge Forward, and Best Overall (NVIDIA DGX Spark). **Our deadline is 5:15 PM**; the official one is 5:30.

- **Check in:** scan a signed, expiring QR code at a talk or booth to earn XP.
- **Talk quiz:** an Elastic Agent Builder "Quest Master" writes 3 questions from the talk transcript. Correct answers earn bonus XP and prove you listened.
- **Meet quest:** "Find someone working on eBPF + platform engineering." Hybrid search over attendee interests picks the person; scanning each other's codes completes the quest.
- **Leaderboard and badges:** for example "Observability Nerd" for 3 OTel talks, computed straight from Elasticsearch aggregations.

**Changes from the draft plan, made to match the published judging criteria:**

1. **Dash0:** add Agent0 or the Dash0 MCP finding and fixing a real problem (a named criterion), plus browser RUM on the Next.js app and a dashboard with one SLO (bonus).
2. **Elastic:** add one Elastic Workflow (Sophia listed Workflows; the draft didn't use them). The draft already covers Jina, Agent Builder, geo and Serverless.
3. **Gitar (Sonar's tool):** a `.gitar/review/` instruction file, repository rules, and one PR per feature from the first hour. Judges check the PR history.
4. **Radar:** use Radar MCP *while building*, and gate each rollout on Radar's checks. Prefer a real incident over a staged one; the staged OOM is the fallback.
5. **Merge Forward:** quizzes and transcripts readable as text, plus a keyboard and screen-reader pass. That's an extra iPad shot for under 30 minutes of work.
6. **Kickoff transcript:** cut it down to the sponsor talks before seeding. The raw file contains teammates' side conversations and the venue Wi-Fi password, and the rules say no personal info in the repo or demo.

## Setup runbook: now → 12:15 gate

Setup is done when the 12:15 gate passes: a hello-world page on `https://<team>.cnh.radarhq.io`, deployed by Argo CD from a Gitar-reviewed PR, with its first trace in Dash0. Steps 1–5 run in parallel. First, pick one lowercase team slug (for example `kubequest`); it becomes the namespace `team-<team>` and the URL.

**Day-one shortcut:** ship as **one** Next.js service first (game API as Next.js route handlers). The starter routes the team URL to the `app` Service and builds one image, so a second `api` service means a second image build and extra manifests, about 30–45 minutes. Split it out after 2 PM only if the platform lane is ahead. Traces still go phone (RUM) → Next.js → Elastic end to end.

### 0 · Everyone (5 min)

- [ ] One person creates the team on the hackathon website; everyone joins it so all names are on the submission.
- [ ] Get the Radar join code at the Radar table.
- [ ] Each laptop has Node 20+, the `gh` CLI and a coding agent. Connect Radar MCP so every agent can see the cluster:

```bash
claude mcp add --scope user radar-cloud --transport http https://api.radarhq.io/mcp
# then in Claude Code: /mcp → authenticate → choose the Cloud Native Hackathon org
```

### 1 · Platform owner: repo, cluster, first deploy (20 min)

Claim the team environment at https://join.cnh.radarhq.io with the join code, accept the invite, and sign in at https://app.radarhq.io. Then:

```bash
gh repo create <github-user>/kubequest --public --template skyhook-io/cnh-starter --clone
cd kubequest
./scripts/setup.sh <team>
git add -A && git commit -m "chore: team setup" && git pull --rebase && git push
# add teammates
gh api -X PUT repos/<github-user>/kubequest/collaborators/<teammate-username>
```

- [ ] Wait for the GitHub Actions build to go green, then make the GHCR package **Public** (GitHub → Packages → kubequest → Package settings → Change visibility).
- [ ] Ask the agent: "Apply argocd/application.yaml through Radar MCP and tell me when the rollout is healthy."
- [ ] Open the team URL and confirm the version matches your commit SHA.
- [ ] Protect `main`: Settings → Rules → New branch ruleset → target `main` → require a pull request. **From here on, every change is a PR.**

### 2 · Platform owner: secrets, Dash0, collector (15 min)

- [ ] Start the Dash0 trial at https://www.dash0.com/sign-up. Create a token under Settings → Auth Tokens and copy the OTLP gRPC endpoint under Settings → Endpoints (`ingress.<region>.aws.dash0.com:4317`).
- [ ] Connect the Dash0 MCP server to the agent ([docs](https://dash0.com/docs/dash0/ai/mcp)).
- [ ] Create the Secret in the team namespace: through the agent via Radar MCP, or with kubectl if you have a kubeconfig. Values never go in the repo.

```bash
kubectl -n team-<team> create secret generic app-credentials \
  --from-literal=ES_URL='<elastic endpoint>' \
  --from-literal=ES_API_KEY='<elastic api key>' \
  --from-literal=DASH0_OTLP_ENDPOINT='ingress.<region>.aws.dash0.com:4317' \
  --from-literal=DASH0_AUTH_TOKEN='<dash0 token>' \
  --from-literal=QR_HMAC_SECRET="$(openssl rand -hex 32)"
```

- [ ] Add `deploy/otel-collector.yaml`: a ConfigMap with the config below, a Deployment (image `otel/opentelemetry-collector-contrib`, 256Mi memory limit, `DASH0_*` env vars from `app-credentials`), and a Service named `otel-collector` on ports 4317 and 4318. List it in `deploy/kustomization.yaml`.

```yaml
receivers:
  otlp:
    protocols:
      grpc: { endpoint: 0.0.0.0:4317 }
      http: { endpoint: 0.0.0.0:4318 }
processors:
  memory_limiter: { check_interval: 1s, limit_mib: 200 }
  resource:
    attributes:
      - { key: deployment.environment.name, value: cnh-hackathon, action: upsert }
      - { key: k8s.namespace.name, value: team-<team>, action: upsert }
  batch: {}
exporters:
  otlp/dash0:
    endpoint: ${env:DASH0_OTLP_ENDPOINT}
    headers:
      Authorization: "Bearer ${env:DASH0_AUTH_TOKEN}"
      Dash0-Dataset: default
    compression: gzip
service:
  pipelines:
    traces:  { receivers: [otlp], processors: [memory_limiter, resource, batch], exporters: [otlp/dash0] }
    metrics: { receivers: [otlp], processors: [memory_limiter, resource, batch], exporters: [otlp/dash0] }
    logs:    { receivers: [otlp], processors: [memory_limiter, resource, batch], exporters: [otlp/dash0] }
```

- [ ] In `deploy/deployment.yaml`, give the app `OTEL_SERVICE_NAME=kubequest-web`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318`, and `ES_URL`, `ES_API_KEY`, `QR_HMAC_SECRET` from the Secret by name.

### 3 · Anyone: Gitar config as the first PR (10 min)

- [ ] Sign up at https://app.gitar.ai/sign-up with GitHub, install the app on the `kubequest` repo only, and start the 14-day trial (no card).
- [ ] On branch `chore/gitar-config`, add these files (format per [repository config docs](https://docs.gitar.ai/configuration/repository-config.md)) and open a PR. It becomes the first Gitar-reviewed PR in the history.
  - `.gitar/review/security.md`: check-in routes must verify the HMAC signature, 10-minute expiry and one scan per attendee per location; no secrets in code or manifests (use `app-credentials`); never pass user input into Elasticsearch scripts.
  - `.gitar/review/kubequest.md`: every Elasticsearch call sets a timeout; every route that awards XP emits a span with `kubequest.*` attributes; UI components need accessible labels.
  - `.gitar/rules/ai-disclosure.md`: in plain language, require the PR description to say which AI assistant helped.
  - `.gitar/config/apply.md`: auto-apply criteria, such as fixing failing CI and review findings tagged as bugs or security ([auto-apply docs](https://docs.gitar.ai/features/code-review/auto-apply.md)).

### 4 · Elastic owner: Serverless project and indices (20 min)

- [ ] Create an Elasticsearch Serverless project from https://ela.st/hack-kubecon. Copy the endpoint, create an API key, and DM both to the platform owner for the Secret.
- [ ] In Kibana Dev Tools, create the indices. Naming the Jina endpoint explicitly makes the Jina usage visible to Sophia (it's also the Serverless default).

```json
PUT talks
{ "mappings": { "properties": {
  "title": { "type": "text" }, "speaker": { "type": "keyword" },
  "location_id": { "type": "keyword" }, "start": { "type": "date" }, "tags": { "type": "keyword" },
  "transcript": { "type": "semantic_text", "inference_id": ".jina-embeddings-v5-text-small" } } } }

PUT attendees
{ "mappings": { "properties": {
  "handle": { "type": "keyword" }, "interests_text": { "type": "text" },
  "interests": { "type": "semantic_text", "inference_id": ".jina-embeddings-v5-text-small" },
  "last_location": { "type": "geo_point" }, "floor": { "type": "integer" },
  "opt_in_meet": { "type": "boolean" }, "badges": { "type": "keyword" } } } }

PUT locations
{ "mappings": { "properties": {
  "location_id": { "type": "keyword" }, "name": { "type": "text" }, "kind": { "type": "keyword" },
  "floor": { "type": "integer" }, "point": { "type": "geo_point" } } } }

PUT quests
{ "mappings": { "properties": {
  "attendee": { "type": "keyword" }, "type": { "type": "keyword" }, "target": { "type": "keyword" },
  "prompt": { "type": "text" }, "status": { "type": "keyword" }, "created": { "type": "date" } } } }

PUT xp_events
{ "mappings": { "properties": {
  "attendee": { "type": "keyword" }, "type": { "type": "keyword" }, "xp": { "type": "integer" },
  "talk_id": { "type": "keyword" }, "location_id": { "type": "keyword" },
  "trace_id": { "type": "keyword" }, "ts": { "type": "date" } } } }
```

- [ ] Storing `trace_id` on every XP event is what makes "click a leaderboard entry, open its trace" work in the demo.
- [ ] Smoke test: index one talk, then run `GET talks/_search` with `{"query":{"semantic":{"field":"transcript","query":"observability"}}}`.
- [ ] Ask Sophia whether Agent Builder and Workflows are enabled on the trial project; if not, take the fallback in the Risks table.

### 5 · UI owner: Next.js in the starter (20 min)

The starter expects `app/` to listen on `$PORT` (8080) with `/healthz` and `/readyz`. On branch `feat/nextjs-skeleton`, give the agent this prompt:

> Replace the starter's `app/` with a Next.js App Router app in TypeScript. Keep it on `$PORT` (default 8080) with `GET /healthz` and `GET /readyz` returning 200. Update the Dockerfile for a Next.js standalone build. Add OpenTelemetry through `instrumentation.ts` using `@opentelemetry/sdk-node` with Node auto-instrumentations and OTLP HTTP exporters for traces, metrics and logs, reading `OTEL_EXPORTER_OTLP_ENDPOINT`. Add `GET /api/ping` that creates a custom span with attribute `kubequest.setup=true`. Open a PR; do not push to main.

Merge after Gitar reviews it. Argo CD deploys it; then hit `/api/ping` on the team URL.

### 12:15 gate checklist

- [ ] The team URL shows the latest commit SHA.
- [ ] Radar (via MCP or app.radarhq.io) shows the app and collector pods healthy.
- [ ] Dash0 shows a trace from `kubequest-web` with `kubequest.setup=true`.
- [ ] At least 2 PRs merged with Gitar reviews.
- [ ] The five Elastic indices exist and the semantic smoke test returns a hit.

## Rules and judging

Submissions close at **5:30 PM MT today**. Demos run 5:30–6:30 PM and winners are announced 6:30–7:00 PM. Building opened at 11:00 AM, which leaves about 6 hours. One project per team, and it can enter every sponsor track whose tool it genuinely uses, plus Merge Forward. Every project is eligible for Best Overall. ([schedule](https://www.wemakedevs.org/hackathons/cnh/schedule), [event page](https://www.wemakedevs.org/hackathons/cnh))

| Track | Prize | What judges score |
| --- | --- | --- |
| [1 · Gitar (Sonar): Never Merge Broken](https://www.sonarsource.com/resources/library/get-started-with-gitar/) | $4,000 | Features land through PRs Gitar reviewed (not one PR at the end); review instructions + repo rules; CI failure diagnosis and auto-apply fixing real problems; conference value |
| [2 · Dash0: Stop Flying Blind](https://www.dash0.com/sign-up) | $4,000 | Depth of instrumentation (traces, logs, metrics, RUM); Agent0 or MCP finding and fixing a real problem, shown in the demo; observability as part of the product; bonus for a dashboard or SLO |
| [3 · Radar: AI SRE](https://github.com/skyhook-io/radar) | $4,000 | Runs on Kubernetes with Radar connected; Radar UI + MCP used while building and operating; AI investigation on a real issue, showing what you learned and did |
| [4 · Elasticsearch: Find the Right Talk](https://ela.st/hack-kubecon) | $4,000 | Elasticsearch is the core data layer, not a side feature; smart keyword, semantic, vector or hybrid search |
| [Merge Forward: Conferences for Everyone](https://ocgroups.dev/cncf/group/merge-forward) | iPad | Makes conferences more inclusive and accessible |
| Best Overall | NVIDIA DGX Spark | No rubric published; any project is eligible |

**What the sponsors added at kickoff** (from the team's kickoff transcript):

- **Dash0 (Evgeny, director of product):** scoring is on how well you use OpenTelemetry: instrumentation, **semantic conventions**, **collector configs**, and **correlating logs with traces**. Dash0 also offers agent skills.
- **Sonar (Kelly Carlson):** billed as the *security* sponsor. Gitar's out-of-the-box review catches logic bugs, security issues, maintainability and readability problems. It has auto-apply (pushes fixes to the branch), optional auto-merge, learns from your corrections, and diagnoses CI logs and pushes fixes.
- **Elastic (Sophia):** depth and creativity of the Elasticsearch implementation, **Jina AI models** through Elastic Cloud, **Agent Builder**, **Workflows**, **geo queries**, and **Elastic Cloud Serverless**.
- **Radar (Roy):** you must run on a cluster (theirs via join code, or your own), use **AI investigations on a real issue**, and show "meaningful decisions Radar helped you with" such as verified healthy releases, checks and rollouts.
- **Organizers:** submit on the hackathon website. **Register a team and add every member's name before submitting**; only one person submits. Using all four tools is the recommended path to the DGX Spark.

**Hard rules that can disqualify us** ([rules](https://www.wemakedevs.org/hackathons/cnh/rules)):

- Main coding starts after kickoff. Ideas and research done beforehand are fine.
- Public repo with a README that has setup instructions.
- AI coding assistants are allowed **but must be disclosed**. Fully AI-generated projects with no real understanding can be rejected, so every team member must be able to explain the architecture.
- No private or personal data in the repo or demo. Use seeded or fake attendee profiles.

**Judges** include Kelsey Hightower, Justin Garrison, Nadav Erell (Radar) and Julia Furst Morgado (Dash0). Expect sponsor-affiliated judges to check that their tool was genuinely used, not just name-dropped.

## Product

**Problem.** KubeCon NA (Nov 9–12, Salt Palace) has hundreds of sessions and thousands of people. Attendees skip talks, stay in their own bubble, and leave without meeting the people working on their exact problem. Sponsors want booth traffic, and organizers can't see engagement. KubeQuest is a game whose points reward what a conference wants people to do: show up, listen and meet people.

**Users:** attendees (play), sponsors and booths (get visits), organizers (live engagement view, a stretch goal).

**Core loop (must ship)**

| Feature | How it works | Done when |
| --- | --- | --- |
| Check-in | Each talk and booth has a QR code holding a signed (HMAC) token with the location ID and a 10-minute expiry. The api verifies it and writes an `xp_event` | Forged or expired tokens are rejected; a valid scan adds XP in under 1 s |
| Talk quiz | After check-in, the Agent Builder Quest Master reads that talk's transcript chunks and writes 3 multiple-choice questions, cached per talk | 3 questions per seeded talk; correct answers award bonus XP |
| Meet quest | Attendee interests are embedded with Jina. A hybrid query (BM25 + vector) picks a complementary person, preferring people checked in nearby | The quest card names one person and why; a mutual scan completes it |
| Leaderboard + badges | Leaderboard = a sum aggregation over `xp_events`. An Elastic Workflow checks badge rules on new XP events (e.g. 3 OTel talks = Observability Nerd) | Leaderboard updates live; at least 3 badges fire |
| Quests near you | Every room and booth has a `geo_point`; `geo_distance` sorts open quests from your last check-in | The list re-sorts after each check-in |
| Accessible mode (Merge Forward) | Quizzes and transcripts are plain text, quizzes have no timer, full keyboard navigation and screen-reader labels | A keyboard-only run-through of the whole loop works |

**Seed data:** 4–5 talk transcripts (including the trimmed kickoff sponsor talks), about 30 clearly fake attendees, and about 10 rooms and booths with QR codes. For the demo, show the codes on a second laptop or print them.

**Stretch (only if the core is green by 3:30 PM):** XP-velocity anti-cheat flag; organizer heatmap of check-ins per room; speaker view of quiz scores.

**Non-goals today:** native apps; live audio or video upload and transcription (seeded transcripts only); real attendee data or logins; passive tracking of anyone.

## Architecture

There are two services and a collector in one team namespace. Elastic is the only datastore, and every request is traced end to end.

&#91;embedded content: KubeQuest architecture · delivery, runtime, data and operations\]

A check-in goes phone → web → api → Elastic, and both services send telemetry through the in-namespace collector to Dash0. Code reaches the cluster only through a Gitar-reviewed PR and Argo CD, and Radar watches every rollout.

| Piece | Choice | Note |
| --- | --- | --- |
| web | Next.js, OTel SDK + browser RUM | Becomes the starter's `app` Service, so the team URL points at it |
| api | Node (matches the starter), OTel auto-instrumentation, pino JSON logs with trace IDs | Check-in token verification, XP writes, calls to Agent Builder |
| Collector | `opentelemetry-collector-contrib` Deployment; config committed at `deploy/otel-collector.yaml` | Dash0 judges the collector config itself |
| Data + AI | Elastic Cloud Serverless: Jina embeddings, RRF hybrid search, Agent Builder, Workflows, geo | API key in the `app-credentials` Secret |
| Delivery | GitHub PR → Gitar → Actions → GHCR → Argo CD | Comes with the [cnh-starter](https://github.com/skyhook-io/cnh-starter) template |
| Operations | Radar Cloud + MCP; Dash0 + MCP and Agent0 | Both MCP servers connected to the coding agent from hour one |

## Track-by-track win plan

The tracks share one incident story: **something breaks on the cluster → Radar's AI investigation finds the Kubernetes cause → Dash0 Agent0 finds the code cause → the fix lands as a PR that Gitar reviews → Argo CD redeploys → Radar checks and the Dash0 SLO go green.** Keep Radar open from the first deploy. The first *real* failure (missing Secret, failing probe, OOMKilled, slow quiz generation under load) is the incident; screenshot it as it happens. If nothing real breaks by 3:30 PM, use the draft's fallback, a leaderboard rollout with a too-tight memory limit, and say plainly in the demo that it was deliberate. Judges asked for a real issue.

### Track 1 · Sonar (Gitar): security and "Never Merge Broken"

- [ ] By 11:45, install the Gitar GitHub App on the repo and start the free Pro trial. Turn on auto-apply ([quickstart](https://docs.gitar.ai/quickstart)).
- [ ] Write `.gitar/review/` instructions specific to KubeQuest: "check-in routes must verify the HMAC signature, expiry and one-scan-per-attendee", "no secrets in code or manifests; use the `app-credentials` Secret", "every Elasticsearch call sets a timeout and never puts user input into scripts", "every route that awards XP emits a span".
- [ ] Add repository rules (for example, a required AI-disclosure line in the PR template).
- [ ] Protect `main`: **one PR per feature, starting in the first hour.** Aim for 10 or more.
- [ ] Tell the security story honestly: check-in v1 is the simplest version (location ID in the URL, so XP can be spoofed). Gitar's review or your rule flags it, and the next PR adds signed 10-minute tokens plus a nonce. Don't plant fake bugs beyond that natural first version.
- [ ] CI runs lint, token-verification unit tests and manifest validation. Capture one real CI failure that Gitar diagnosed and auto-fixed.

### Track 2 · Dash0: OpenTelemetry done properly

- [ ] Add the OTel SDK to both `web` (Next.js) and `api`. They export OTLP to an **in-namespace OTel Collector** whose config is committed in the repo: OTLP receiver → `memory_limiter` + `batch` + resource attributes (`service.name`, `service.version`, `deployment.environment`, pod name via the downward API) → Dash0 exporter, with the token from the Secret.
- [ ] Follow semantic conventions: standard `http.*` and `db.system=elasticsearch` spans, plus custom attributes in a project namespace: `kubequest.quest.type`, `kubequest.talk.id`, `kubequest.xp.awarded`. Namespacing custom attributes is itself the convention, and Evgeny named semantic conventions as a criterion.
- [ ] Structured JSON logs carrying `trace_id` and `span_id` so Dash0 links logs to traces.
- [ ] Metrics: an XP-awarded counter, a check-in counter, and a quiz-generation duration histogram.
- [ ] Browser RUM on the Next.js app ([guide](https://dash0.com/guides/website-monitoring-with-opentelemetry-and-dash0)).
- [ ] Connect the Dash0 MCP server to the coding agent ([docs](https://dash0.com/docs/dash0/ai/mcp)). Use Agent0 on the incident and have it propose the fix PR ([Agent0](https://www.dash0.com/agent0)).
- [ ] Bonus: a dashboard plus one SLO, such as check-in p95 under 500 ms.
- [ ] Demo line: "Every point in this game is traceable." Click a leaderboard entry and open its trace.

### Track 3 · Radar: Kubernetes SRE

- [ ] Get the join code at the Radar table, claim the team namespace at join.cnh.radarhq.io, and start from the [cnh-starter](https://github.com/skyhook-io/cnh-starter) template: run `scripts/setup.sh <team>`, make the GHCR image public, and apply the Argo CD app through Radar MCP.
- [ ] `web` is the starter's `app` Service, so the team URL routes to it. Add `api` and `otel-collector` Deployments and Services under `deploy/`. Secrets go in `app-credentials`: Elastic API key, Dash0 token, HMAC key.
- [ ] Connect Radar Cloud MCP: `claude mcp add --scope user radar-cloud --transport http https://api.radarhq.io/mcp`. After every merge, ask the agent through Radar whether the rollout is healthy, and don't move on until Radar's checks are green.
- [ ] Keep `docs/radar-log.md` of the decisions Radar drove, for example "Radar showed api OOMKilled at 256Mi, so we raised it to 512Mi" or "the timeline tied the latency spike to the quiz-generator rollout, so we rolled back." Roy asked for exactly these meaningful decisions.
- [ ] Run an AI investigation on the incident; capture what it found, what changed, and what we did.

### Track 4 · Elastic: the database

- [ ] Create an **Elastic Cloud Serverless** project ([trial](https://ela.st/hack-kubecon)). Elastic is the only datastore.
- [ ] Indices:
  - `talks`: title, speaker, location, start time, and transcript chunks as `semantic_text` embedded with Jina.
  - `attendees`: handle, interests as `semantic_text`, last location `geo_point`, opt-in flag.
  - `locations`: rooms and booths, `geo_point`, floor.
  - `quests`.
  - `xp_events`: attendee, type, XP, talk, timestamp.
- [ ] **Jina:** embeddings for transcripts and interests through Elastic's inference service; optionally the Jina reranker on match results. Confirm the available model IDs with Sophia at 11:45.
- [ ] **Hybrid search:** an RRF retriever combining BM25 and a semantic query for meet-quest matching.
- [ ] **Agent Builder:** the Quest Master agent, grounded in `talks` and `attendees`, returns quiz JSON and meet-quest text. The api calls it and caches results per talk.
- [ ] **Workflows:** a workflow evaluates badge rules on new XP events (or every minute if trigger setup is slow) and writes badges.
- [ ] **Geo:** `geo_distance` sorting for "quests near you", with floor as a filter.
- [ ] The leaderboard and organizer stats are aggregations or ES|QL, so there's no second database.

### Merge Forward · Conferences for Everyone

- [ ] Accessible mode: transcripts and quizzes as readable text (this helps Deaf and hard-of-hearing attendees), no quiz timers, keyboard navigation, screen-reader labels, and badges that don't rely on color alone.
- [ ] At least one quest type that doesn't require walking between floors, such as a quiz-only quest, for attendees with limited mobility.
- [ ] Meet quests are opt-in, and check-ins carry only a pseudonymous handle.

### Best Overall (DGX Spark)

Put a QR code on the demo screen so judges check in live. Their XP appears on the leaderboard, and the same check-in appears as a trace in Dash0. A product everyone in the room understands instantly, running on a real URL, with genuine depth in all four tools, is the strongest Best Overall case.

## Build plan

The app is live on the cluster with traces flowing by 12:15 PM, so every later feature ships through Gitar, Argo CD, Radar and Dash0 rather than being bolted on at the end.

&#91;embedded content: Build plan · 3 lanes, 5 phases, 2 gates\]

This moves deployment and OTel from the draft's 2:00–3:30 block into the first hour. Dash0's own guide says to instrument in the first hour, and the Radar and Gitar criteria need history from the whole day.

**Team split (3–4 people):** one owner per lane. Whoever finishes first owns the demo script and README. With 2 people, the platform owner also takes the Elastic lane's Workflows and geo, and those are the first cuts if time runs short.

## Demo script (3 minutes)

The slot length isn't published (demos run 5:30–6:30 PM), so plan for 3 minutes with a 90-second cut. Show the live app and real tool screens, not slides.

1. **0:00–0:20 · Hook.** "Conferences are a game nobody gave you the rules for." Show the QR code on screen and have the judges check in on their phones.
2. **0:20–1:10 · Play (Elastic + Merge Forward).** A judge's check-in earns XP. The Quest Master's 3-question quiz is generated from the kickoff talk the judges just sat through. Then a meet quest ("find someone working on eBPF + platform engineering"), the leaderboard moving, and a badge firing. Ten seconds of keyboard-only accessible mode.
3. **1:10–1:30 · Every point is traceable (Dash0).** Click the judge's XP event and open its trace: web → api → Elasticsearch, with `kubequest.*` attributes and the correlated logs.
4. **1:30–2:30 · The incident (Radar + Dash0 + Gitar).** Radar's AI investigation names the cause, Agent0 points at the code, the fix PR shows Gitar's review (and the security catch on check-in v1), Argo CD redeploys, and Radar's checks and the SLO return to green.
5. **2:30–3:00 · Close.** Flash the PR list, the Radar decision log and the Dash0 dashboard. "Live at `<team>.cnh.radarhq.io` right now. Keep playing during the after-party."

Record a backup screen capture of steps 2–4 by 5:00 PM in case the Wi-Fi fails.

## Submission checklist and risks

**Before 5:15 PM**

- [ ] Team registered on the hackathon site, with **every member's name added** before the one person submits.
- [ ] Public GitHub repo. The README covers what it does, the architecture, setup steps, the live URL, a section per sponsor showing how each tool was used, and an **AI-assistant disclosure** (required by the rules).
- [ ] Kickoff transcript trimmed to the sponsor talks only. No teammates' side conversations, no Wi-Fi password, no real attendee data.
- [ ] Everyone can explain the architecture without notes (rule 6).
- [ ] At 5:00 PM, Radar's checks are green and the Dash0 SLO is green.
- [ ] Screenshots saved: Gitar review + auto-fix, Radar investigation, Agent0 diagnosis, Dash0 trace and dashboard.
- [ ] Backup demo video recorded.
- [ ] Submitted for Sonar, Dash0, Radar, Elastic and Merge Forward.

**Risks**

| Risk | Likelihood | Fallback |
| --- | --- | --- |
| Scope: six features plus four tools in 5 hours | High | Cut in this order: geo quests, Workflows badges (compute badges in the api), meet-quest scanning. Check-in + quiz + leaderboard is the minimum game |
| Agent Builder or Workflows not enabled on the Serverless trial | Medium | Ask Sophia at 11:45; fallback is calling an LLM from the api using retrieved transcript chunks (still grounded in Elastic) |
| Shared-cluster RBAC blocks collector extras (e.g. `k8sattributes`) | Medium | Set resource attributes with the downward API instead; the collector still runs in the namespace |
| No real incident happens | Medium | Fall back to the deliberate leaderboard OOM; be upfront about it |
| Quiz generation is slow during the demo | Medium | Pre-generate and cache quizzes for every seeded talk at seed time |
| QR spoofing makes the leaderboard look broken during the demo | Low | Signed, expiring tokens plus one scan per attendee per location |
| Venue Wi-Fi fails | Medium | Backup video + phone hotspot |
