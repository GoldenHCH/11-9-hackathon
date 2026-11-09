# KubeQuest

**KubeQuest turns KubeCon into a block world.** Every room, booth and meeting point is a place you check in to. Quests tell you which talk to catch, which booth to visit and who to meet. You earn XP and blocks for showing up (signed QR check-ins), for listening (a short quiz on the talk) and for meeting people (a mutual opt-in Hallway meet at a campfire, confirmed by both sides). Sets of blocks earn banners, XP moves you from Pod to Control Plane, and the leaderboard shows who is out there playing.

- **Live:** https://kube-quest.cnh.radarhq.io
- **Built for:** WeMakeDevs Cloud Native Hackathon, KubeCon NA 2026, Salt Lake City (Nov 9 2026)
- **Spec:** [`knowledge-graph/game-design.md`](knowledge-graph/game-design.md) (game design), [`brief/brief.md`](brief/brief.md) (challenge and rubric), [`docs/architecture.md`](docs/architecture.md) (routes, tools, lanes)

## Architecture

```
  phone camera / browser                  assistant (Agent Builder)     MCP clients     CronJob
          |                                         |                        |              |
          v                                         v                        v              v
  +----------------------------------------------------------------------------------------------+
  | Node image (team-kube-quest / Deployment app / Service app:80)                              |
  |                                                                                              |
  |   Express: /r/:locationId  /api/tools/:name  /api/screen-token/:id  /healthz  /readyz        |
  |       |                                                                                      |
  |       v                                                                                      |
  |   app/src/tools/*.tool.ts   <- the only code that touches data; no model inside; 1 span each |
  |       |            |                                                                         |
  |       |            +-- xp/award.ts  (only writer to xp_events, stores traceId on every event)|
  |       v                                                                                      |
  |   es/client.ts (timeouts on every call)          observability/* (OTel traces, metrics, logs)|
  +-------|------------------------------------------------------|-------------------------------+
          |                                                      |
          v                                                      v  OTLP/HTTP :4318
  Elastic Cloud Serverless                              otel-collector (in namespace)
   - semantic_text (Jina v5)                                      |
   - retriever: rrf hybrid                                        v
   - geo_distance campfires                                     Dash0
   - aggregations (leaderboard, boss health)
   - inference API + Agent Builder
   - Workflows (banners)

  GitHub (PR + Gitar review) --push main--> GHCR image --> Argo CD in vcluster kube-quest --> deploy/
```

## Sponsors

### Elastic: the only datastore

There is no other database, cache or file store. Everything the game knows lives in Elastic Cloud Serverless.

- **`semantic_text` with Jina embeddings** (`.jina-embeddings-v5-text-small`) on talks, locations, quests and attendee interests. "Where can I learn about eBPF?" finds the right talk without exact words.
- **Hybrid search with the `rrf` retriever**: a BM25 `standard` retriever and a `semantic` retriever fused with reciprocal rank fusion. This powers `search`, `recommend_talks` and `recommend_people`.
- **`geo_distance` campfires**: when two players accept a meet, the game picks the meeting point closest to both of them.
- **Aggregations** compute the leaderboard (`terms` + `sum` over `xp_events`), the community boss's remaining health and the organizer stats.
- **Inference API** for language tasks (quiz generation, Hallway icebreakers) through an Elastic-hosted completion endpoint, and **Agent Builder** (Kibana `/api/agent_builder`) as the assistant, which calls the same tools the UI uses.
- **Workflows** award banners when a player completes a set of blocks.

### Dash0: every XP point is traceable

- The **OpenTelemetry Node SDK** loads before the app (`node --require ./dist/otel.js dist/server.js`) and exports traces, metrics and logs over OTLP/HTTP to an **in-namespace OpenTelemetry Collector** (config in `deploy/`), which forwards to Dash0. The Dash0 token lives only in the `app-credentials` Secret.
- **Semantic conventions** for HTTP, `service.*`, `deployment.environment` and `k8s.*` resource attributes, plus our own `kubequest.*` attributes (`kubequest.tool`, `kubequest.attendee.id`, `kubequest.location.id`, `kubequest.xp.awarded`, ...).
- Every tool runs inside a span named `tool.<name>`. Every route that awards XP sets `kubequest.xp.awarded` on its span.
- **Metrics:** `kubequest.xp.awarded`, `kubequest.checkins`, `kubequest.handshakes`, `kubequest.quiz.duration`.
- **Logs and traces are linked**: the pino logger writes `trace_id` and `span_id` on every line.
- **Every XP event stores its `traceId`**, so any point on the leaderboard opens the exact request in Dash0 that awarded it. See [`docs/ops.md`](docs/ops.md) for the trace URL.

### Radar: the cluster, run through an agent

- The team runs in its own **vcluster `kube-quest`**, namespace `team-kube-quest`, with a tight budget (2 CPU and 4 GiB of requests across everything).
- Deploys are **GitOps with Argo CD**: `argocd/application.yaml` points at `deploy/`, and every push to `main` builds an image and syncs.
- We used the **Radar Cloud UI** to apply the Argo CD Application (after reviewing the dry-run diff) and the **Radar MCP server** from Claude Code to create and extend the `app-credentials` Secret, sync, watch rollouts and read events and logs.
- Radar **Checks** before and after, and an **AI investigation** on a real symptom. The story is in [`docs/radar-log.md`](docs/radar-log.md).

### Gitar (and Sonar): every change through review

- Every change lands through a pull request. Nothing is pushed to `main` by hand except the deploy bot's commits.
- Review rules live in [`.gitar/review/`](.gitar/review): conventions (tools are the only data path, no model inside tools, a span per tool) and security (signed check-in tokens, `awardXp` as the only XP writer, no photo or "how to spot me" before a mutual accept, a timeout on every Elasticsearch call, no user input in scripts).
- [`.gitar/rules/`](.gitar/rules) holds PR checks (AI disclosure on every PR), and [`.gitar/config/apply.md`](.gitar/config/apply.md) lets Gitar auto-apply fixes except to token signing and XP math, which need a human.

## Demo flow

1. Open https://kube-quest.cnh.radarhq.io on a phone, pick a handle, get a pixel face and a first quest.
2. Search "where can I learn about eBPF" and show the hybrid (RRF) results with the room and time.
3. Scan the room's QR block: +10 XP and a block. Open the trace for that XP event in Dash0.
4. Answer the three-question quiz on the talk: +5 XP per correct answer.
5. Accept a meet quest on two phones: both accept, the game picks a campfire by `geo_distance` and shows an icebreaker. Both scan the campfire code: +50 XP and a gem each.
6. Show the leaderboard and the boss health bar (Elastic aggregations), and a banner awarded by an Elastic Workflow.
7. Show Radar: the Argo CD sync of the last push, Checks before and after, and the AI investigation.

## Run it locally

Requirements: Node 22 and an Elastic Cloud Serverless project.

```bash
cd app
npm i
```

Create `app/.env` (gitignored, never commit it) with these keys:

| Key | What it is |
|-----|-----------|
| `ELASTIC_URL` | Elasticsearch endpoint of the Serverless project |
| `ELASTIC_API_KEY` | API key with read and write on the KubeQuest indices |
| `ELASTIC_INFERENCE_ID` | Embedding endpoint for `semantic_text` (default `.jina-embeddings-v5-text-small`) |
| `ELASTIC_CHAT_INFERENCE_ID` | Completion endpoint for quizzes and icebreakers (optional) |
| `KIBANA_URL`, `ELASTIC_AGENT_ID` | Agent Builder assistant (optional) |
| `QR_SECRET` | HMAC key that signs check-in QR tokens |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP endpoint (optional locally) |

Then create the indices, load the seed data and start the dev server:

```bash
npm run index-all
npm run dev
```

The API listens on http://localhost:8080. `GET /healthz`, `GET /readyz` and `GET /api/tools` are good first checks.

Operations, secrets and QR printing: [`docs/ops.md`](docs/ops.md).

## AI disclosure

KubeQuest was built with **Claude Code** (Anthropic), working in parallel agent lanes on the backend, the docs and the deploy setup, with every change reviewed by the team. The game itself uses models only through Elastic (the inference API and Agent Builder), never inside the tools that award XP.

## License

See [LICENSE](LICENSE).
