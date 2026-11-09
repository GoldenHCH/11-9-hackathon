# Phase 00 + 04 — Platform: cnh-starter, Argo CD, OTel Collector, Gitar, Radar

**Goal:** the hello app is live at `https://kube-quest.cnh.radarhq.io` through Argo CD by 12:00, every PR gets a Gitar review, every span and log reaches Dash0 through a collector whose config is in the repo, and Radar is part of how we work from the first deploy.
**Brief requirements covered:** Radar (runs on Kubernetes, Radar MCP while building and operating, decision log); Dash0 (collector config, semantic conventions, logs correlated with traces, RUM); Sonar (review instructions, repo rules, PRs from hour one); public repo.
**Depends on:** nothing. Golden's Phase 01 waits only for the repo to exist (step 1 below).
**Owner:** Collin. **Budget:** 11:30–12:40.
**Rules to load:** `rules/hackathon.md`, `rules/git.md`. Also read the starter's own `AGENTS.md` and `.claude/` skills; they cover ship, debug, canary and "the 5:30 story".

## Phase 00 — repo and hello app (11:30–12:00)

- [x] cnh-starter merged into `GoldenHCH/11-9-hackathon` in place instead of a new repo: starter files copied in, our `AGENTS.md` index kept with the starter's notes appended, kit README moved to `docs/starter-kit.md`
- [ ] Make `GoldenHCH/11-9-hackathon` **public** (Argo CD reads it without credentials) and add Collin as admin
- [ ] Join code from the Radar table → `join.cnh.radarhq.io`; team name `kube-quest`; progress at `join.cnh.radarhq.io/status/kube-quest (first cluster `kubequest` failed setup on Radar's side)`
- [x] `./scripts/setup.sh kubequest` (done locally); still to do: `git commit -am "Set up team kubequest" && git pull --rebase && git push`
- [ ] GitHub → Packages → the image → Package settings → Change visibility → **Public** (the cluster can't pull private images)
- [ ] Radar MCP: `claude mcp add --scope user radar-cloud --transport http https://api.radarhq.io/mcp`, then `/mcp` → radar-cloud → Authenticate → organization "Cloud Native Hackathon". Note the team's `cluster` id; every Radar MCP call needs it
- [ ] Ask the agent to apply `argocd/application.yaml` through Radar MCP. Confirm the pod is Ready in Radar and `https://kube-quest.cnh.radarhq.io/healthz` answers
- [ ] First line in `docs/radar-log.md`: time, "applied Argo app via Radar MCP, rollout healthy"
- [ ] Keep the Service named `app` on port 80; the platform routes the team URL to it. Leave `httproute.yaml` alone

## Phase 04 — observability and review (12:00–12:40)

### Gitar (10 min)

- [ ] Install the Gitar GitHub App on the repo, start the Pro trial, turn on auto-apply ([quickstart](https://docs.gitar.ai/quickstart))
- [ ] `.gitar/review/` instructions specific to KubeQuest:
  - check-in routes must verify the HMAC signature, the expiry when present, and one scan per attendee per location per hour
  - no secrets in code or manifests; everything sensitive comes from the `app-credentials` Secret
  - every Elasticsearch call sets a timeout and never puts user input into scripts
  - every route that awards XP emits a span with `kubequest.xp.awarded`
  - no model call inside `app/src/tools/`; Elasticsearch is the only datastore
  - TypeScript: no comments, newline at end of file, prompts in `.constants.ts`
- [ ] Repository rules: PR template with a required AI-disclosure line; `main` protected, PRs only
- [ ] Throwaway PR to confirm Gitar comments, then close it

### OTel Collector (15 min) — `deploy/otel-collector.yaml`, `deploy/collector-config.yaml`

- [ ] `opentelemetry-collector-contrib` Deployment + Service in the namespace; config as a ConfigMap committed in the repo: OTLP receiver (grpc + http) → `memory_limiter` → `batch` → `resource` processor (`service.name`, `service.version`, `deployment.environment=hackathon`, pod name via the downward API) → Dash0 exporter with the token from `app-credentials`
- [ ] Add both to `deploy/kustomization.yaml` so Argo CD ships them
- [ ] If RBAC blocks `k8sattributes`, keep the downward-API attributes and move on (the PRD's fallback)

### SDK, logs, metrics, RUM (15 min) — in `app/`

- [ ] OTel Node SDK with auto-instrumentation (http, express, the ES client → `db.system=elasticsearch`), exporting OTLP to the collector Service
- [ ] Custom span attributes under `kubequest.*`: `kubequest.tool`, `kubequest.xp.awarded`, `kubequest.talk.id`, `kubequest.location.id`, `kubequest.intro.id`
- [ ] pino JSON logs with `trace_id` and `span_id` on every line, shipped through the collector
- [ ] Metrics: `kubequest.xp.awarded` counter, `kubequest.checkins` counter by location, `kubequest.handshakes` counter, `kubequest.quiz.duration` histogram
- [ ] Browser RUM in the Angular app ([Dash0 guide](https://dash0.com/guides/website-monitoring-with-opentelemetry-and-dash0))
- [ ] Dash0 MCP connected to Claude Code ([docs](https://dash0.com/docs/dash0/ai/mcp))

### Secrets (5 min)

- [ ] `kubectl create secret generic app-credentials -n team-kube-quest --from-literal=ELASTIC_URL=… --from-literal=ELASTIC_API_KEY=… --from-literal=OPENAI_API_KEY=… --from-literal=GITHUB_TOKEN=… --from-literal=DASH0_AUTH_TOKEN=… --from-literal=QR_SECRET=…` (or through Radar MCP `apply_resource`). Never committed; the command lives in `docs/ops.md` with the values blanked
- [ ] `deploy/deployment.yaml` reads them with `envFrom`

### Radar in the workflow (ongoing)

- [ ] After **every** merge: ask the agent through Radar MCP whether the rollout is healthy; don't move on until checks are green. One line per deploy in `docs/radar-log.md`
- [ ] When something real breaks (missing Secret, failing probe, OOMKilled, slow quiz generation), run **Radar's AI investigation first**, screenshot, log what it found and what we changed, then fix. If nothing real breaks by 3:30, the fallback is a leaderboard rollout with a too-tight memory limit, declared as deliberate in the demo

### QR sheet (later, 15 min)

- [ ] `scripts/qr-sheet.ts`: one PDF page per location with `/r/<locationId>?t=<token>` from `resources/locations.json`, plus the demo-screen variant that mints an expiring token
- [ ] Print rooms, meeting points and the hackathon venue code

## Done when

- [ ] `https://kube-quest.cnh.radarhq.io/healthz` answers from the Argo CD-deployed app; Radar shows the Deployment healthy
- [ ] A test PR shows a Gitar comment and a CI check; `main` is protected
- [ ] A request to `/healthz` appears as a trace in Dash0 with `service.name=kubequest-app` and a correlated log line
- [ ] `docs/radar-log.md` has at least two entries; `docs/ops.md` says how to deploy, where secrets live, how to re-run setup
- [ ] Golden's Phase 01 PR, when opened, gets a Gitar review with no further setup
