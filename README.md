# KubeQuest

A conference game for KubeCon NA 2026, built at the WeMakeDevs Cloud Native Hackathon.

**Live:** https://kube-quest.cnh.radarhq.io

## The pitch

KubeQuest is a conference game where points come from showing up, listening and meeting people, and where the meeting actually gets arranged: sign up with your GitHub, scan the QR at a room to earn XP, take a three-question quiz on the talk, and let Hallway match you with someone nearby, propose a time and a spot you're both free for, and hand you an icebreaker.

## Setup

You need Node 22 and an Elasticsearch Serverless project.

```bash
npm install
cp .env.example .env
```

Fill in `ELASTIC_URL` and `ELASTIC_API_KEY` in `.env`. `.env` is gitignored; every variable is described in `.env.example`.

```bash
npm run index-all
npm run dev
```

`index-all` creates the five indices and loads the seed data from `resources/` (see [docs/elastic.md](docs/elastic.md)). `dev` runs the api on port 8080 and the Angular dev server next to it. The api also boots without Elasticsearch configured: `/healthz` then reports `degraded` and the tools answer from the seed files.

| Script | What it does |
|--------|--------------|
| `npm run dev` | api (`tsx watch`) and web dev server together |
| `npm run build` | builds the web app, then the api into `app/dist` |
| `npm run typecheck` | `tsc` over `shared`, `app` and `scripts` |
| `npm run lint` | ESLint over the TypeScript |
| `npm run index-all` | creates the indices and bulk-indexes `resources/` |
| `npm run fixtures` | writes one tool response per tool to `resources/fixtures/` for the UI |

Try a tool without the UI:

```bash
curl -s localhost:8080/api/tools
curl -s -X POST localhost:8080/api/tools/whats_around_me \
  -H 'content-type: application/json' -d '{"attendeeId":"att-demo-platform"}'
```

## How it fits together

One Node image. An Express 5 api in `app/` (TypeScript) serves an Angular build from `app/public`. Elasticsearch Serverless is the only data store: five indices, `semantic_text` fields on Jina embeddings, hybrid search with RRF, `geo_distance` for meeting points. Everything the UI, the assistant, the MCP server and the nudge job do goes through the ten functions in `app/src/tools/` (`check_in`, `recommend_talks`, `recommend_people`, `whats_around_me`, `whats_next`, `propose_intro`, `respond_intro`, `quiz_for_talk`, `submit_quiz`, `leaderboard`). No model runs inside a tool: models phrase text at the edges and rules decide. Every tool call emits an OpenTelemetry span named `tool.<name>` with `kubequest.*` attributes, which an in-cluster collector forwards to Dash0. Types shared by the api and the web app live in `shared/`.

## AI assistance disclosure

We used AI coding assistants to build this project: Claude Code and Codex. We ran several assistant sessions in parallel, each with a narrow task and its own git worktree, and orchestrated them from a lead session. Every change was reviewed by the team before it was merged, and we can explain how the code works. The seed attendees are fake people generated with a model; no real attendee data is in the repo.

## Elastic

## Dash0

## Radar

## Sonar / Gitar

## Merge Forward

## Platform (cnh-starter)

The repo started from Radar's `cnh-starter`. `git push` to `main` runs the `build-and-deploy` GitHub Action, which builds the root `Dockerfile` into a public GHCR image and points `deploy/kustomization.yaml` at it. Argo CD then syncs the `team-kube-quest` namespace of the team cluster, and the app is served at https://kube-quest.cnh.radarhq.io. Probes use `/healthz` and `/readyz` on port 8080. See [AGENTS.md](AGENTS.md) for the cluster and deploy rules, and [docs/starter-kit.md](docs/starter-kit.md) for the agent workflow kit this repo uses.
