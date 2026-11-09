# Phase 00 + 04 — Platform: cnh-starter, Argo CD, OTel Collector, Gitar, Radar

> **Status (14:10 MST):** Phase 00 is done. Most of Phase 04 landed in PR 5: collector, Node SDK, JSON logs with trace ids, all four `kubequest.*` metrics, Gitar review instructions and rules, and `app-credentials` loaded through `envFrom` (verified live in `knowledge-graph/platform-status.md`). Still open. **Collin owns items 1 and 2** (Dash0 keys, the first trace and browser RUM), plus the Dash0 dashboard + SLO in `phase-05-widen.md`; items 3 to 5 have no owner. Checked at 14:10: the live `/api/config` (`ae5e756`) returns no `traceUrlTemplate` and no `rum`. The Secret and Dash0 itself were not re-checked.
> 1. **Dash0 keys** (`DASH0_AUTH_TOKEN`, `DASH0_ENDPOINT`) are not in `app-credentials`, so the collector's `otlp/dash0` exporter sends nothing and no trace has been seen in Dash0. Steps: `docs/ops.md`, "Adding the Dash0 keys". This blocks the Dash0 track and the "open trace" step of the demo. **Owner: Collin.**
> 2. **Browser RUM** in the Angular app (Phase 03 section 8 reads `rum` from `/api/config`) and the **Dash0 MCP** in Claude Code. **Owner: Collin.**
> 3. **Gitar auto-apply is off** for the repo; the Sonar rubric asks for auto-apply evidence. `.gitar/config/apply.md` already limits what it may apply.
> 4. **`main` is not protected** (`gh api repos/GoldenHCH/11-9-hackathon/branches/main` → `protected: false`).
> 5. `app-credentials` has no `OPENAI_API_KEY` or `GITHUB_TOKEN` yet (needed by Phase 02's model fallback and GitHub-grounded profiles).

**Goal:** the hello app is live at `https://kube-quest.cnh.radarhq.io` through Argo CD by 12:00, every PR gets a Gitar review, every span and log reaches Dash0 through a collector whose config is in the repo, and Radar is part of how we work from the first deploy.
**Brief requirements covered:** Radar (runs on Kubernetes, Radar MCP while building and operating, decision log); Dash0 (collector config, semantic conventions, logs correlated with traces, RUM); Sonar (review instructions, repo rules, PRs from hour one); public repo.
**Depends on:** nothing. Golden's Phase 01 waits only for the repo to exist (step 1 below).
**Owner:** Collin. **Budget:** 11:30–12:40.
**Rules to load:** `rules/hackathon.md`, `rules/git.md`. Also read the starter's own `AGENTS.md` and `.claude/` skills; they cover ship, debug, canary and "the 5:30 story".

## Phase 00 — repo and hello app (11:30–12:00)

- [x] cnh-starter merged into `GoldenHCH/11-9-hackathon` in place instead of a new repo: starter files copied in, our `AGENTS.md` index kept with the starter's notes appended, kit README moved to `docs/starter-kit.md`
- [x] Make `GoldenHCH/11-9-hackathon` **public** (Argo CD reads it without credentials). Collin as admin: not checked
- [x] Join code from the Radar table → `join.cnh.radarhq.io`; team name `kube-quest` (the first cluster, `kubequest`, failed setup on Radar's side; ignore its status page)
- [x] `./scripts/setup.sh`, committed and pushed (team moved to `kube-quest` in `24c9a04`)
- [x] GitHub → Packages → the image → Package settings → Change visibility → **Public** (the cluster can't pull private images)
- [x] Radar MCP connected to organization "Cloud Native Hackathon"; cluster `kube-quest`, id `iHuUh5rOFPU`. Every Radar MCP call needs it
- [x] Ask the agent to apply `argocd/application.yaml` through Radar MCP. Confirm the pod is Ready in Radar and `https://kube-quest.cnh.radarhq.io/healthz` answers
- [x] First line in `docs/radar-log.md`: time, "applied Argo app via Radar MCP, rollout healthy"
- [x] Keep the Service named `app` on port 80; the platform routes the team URL to it. Leave `httproute.yaml` alone

## Phase 04 — observability and review (12:00–12:40)

### Gitar (10 min)

- [x] Install the Gitar GitHub App on the repo
- [ ] Start the Pro trial and turn on auto-apply ([quickstart](https://docs.gitar.ai/quickstart)). Auto-apply is still off
- [x] `.gitar/review/` instructions specific to KubeQuest (`conventions.md`, `security.md`) and `.gitar/rules/` (`ai-disclosure.md`, `game-integrity.md`):
  - check-in routes must verify the HMAC signature, the expiry when present, and one scan per attendee per location per hour
  - no secrets in code or manifests; everything sensitive comes from the `app-credentials` Secret
  - every Elasticsearch call sets a timeout and never puts user input into scripts
  - every route that awards XP emits a span with `kubequest.xp.awarded`
  - no model call inside `app/src/tools/`; Elasticsearch is the only datastore
  - TypeScript: no comments, newline at end of file, prompts in `.constants.ts`
- [x] PR template with a required AI-disclosure line (`.github/pull_request_template.md`, enforced by the `ai-disclosure` Gitar rule)
- [ ] `main` protected, PRs only. Currently `protected: false`
- [x] Throwaway PR to confirm Gitar comments (PRs 1–3 all have Gitar reviews)

### OTel Collector (15 min) — `deploy/otel-collector.yaml`

- [x] `opentelemetry-collector-contrib` Deployment + Service in the namespace (`otel/opentelemetry-collector-contrib:0.120.0`, 1/1 Running); config as a committed ConfigMap: OTLP receiver → processors → `debug` and `otlp/dash0` exporters, reading `DASH0_ENDPOINT` and the token from `app-credentials`
- [ ] Dash0 keys in `app-credentials` so the `otlp/dash0` exporter actually sends (see the status note)
- [x] Added to `deploy/kustomization.yaml` so Argo CD ships it
- [ ] If RBAC blocks `k8sattributes`, keep the downward-API attributes and move on (the PRD's fallback). Not checked

### SDK, logs, metrics, RUM (15 min) — in `app/`

- [x] OTel Node SDK with auto-instrumentation (`app/src/otel.ts`), exporting OTLP to the collector Service
- [x] Custom span attributes under `kubequest.*`: `kubequest.tool`, `kubequest.xp.awarded`, `kubequest.talk.id`, `kubequest.location.id`, `kubequest.checkin.rejected_reason`, plus the input attributes from `app/src/tools/define-tool.ts`: `kubequest.attendee.id`, `kubequest.quest.id`, `kubequest.partner.id` and `kubequest.intro.id` (it still carries the meet id: meets replaced intros, the attribute name stayed)
- [x] pino JSON logs with `trace_id` and `span_id` on every line (`app/src/observability/logger.ts`)
- [x] Metrics (`app/src/observability/metrics.ts`): `kubequest.xp.awarded` counter, `kubequest.checkins` counter by location and outcome, `kubequest.handshakes` counter (meets verified at a campfire), `kubequest.quiz.duration` histogram
- [ ] Browser RUM in the Angular app ([Dash0 guide](https://dash0.com/guides/website-monitoring-with-opentelemetry-and-dash0)); Phase 03 section 8 initializes it from `/api/config`
- [ ] Dash0 MCP connected to Claude Code ([docs](https://dash0.com/docs/dash0/ai/mcp))

### Secrets (5 min)

- [x] `app-credentials` exists in `team-kube-quest` with `ELASTIC_URL`, `ELASTIC_API_KEY`, `ELASTIC_INFERENCE_ID`, `QR_SECRET`, `OTEL_SERVICE_NAME`. Never committed; `docs/ops.md` lists every key with the values blanked
- [ ] Add `DASH0_AUTH_TOKEN`, `DASH0_ENDPOINT`, `OPENAI_API_KEY` (or an Elastic key with the LLM entitlement) and `GITHUB_TOKEN`
- [x] `deploy/deployment.yaml` reads them with `envFrom`

### Radar in the workflow (ongoing)

- [ ] After **every** merge: ask the agent through Radar MCP whether the rollout is healthy; don't move on until checks are green. One line per deploy in `docs/radar-log.md`
- [ ] When something real breaks (missing Secret, failing probe, OOMKilled, slow quiz generation), run **Radar's AI investigation first**, screenshot, log what it found and what we changed, then fix. If nothing real breaks by 3:30, the fallback is a leaderboard rollout with a too-tight memory limit, declared as deliberate in the demo. Candidate real issue already logged: the image's `index-all` bundle indexes nothing (`docs/radar-log.md`, section 4)

### QR sheet (later, 15 min)

- [x] `scripts/print-qr-links.ts` prints a signed `/r/<locationId>?t=<token>` link per location (used in place of the planned PDF `scripts/qr-sheet.ts`); the demo screen mints expiring tokens through `GET /api/screen-token/:locationId`
- [ ] Print rooms, outposts, campfires and the hackathon venue code

## Done when

- [x] `https://kube-quest.cnh.radarhq.io/healthz` answers from the Argo CD-deployed app; Radar shows the Deployment healthy
- [ ] A test PR shows a Gitar comment and a CI check; `main` is protected. Gitar and CI: yes. Protection: no
- [ ] A request to `/healthz` appears as a trace in Dash0 with `service.name=kubequest-app` and a correlated log line. Blocked on the Dash0 keys
- [x] `docs/radar-log.md` has at least two entries; `docs/ops.md` says how to deploy, where secrets live, how to re-run setup
- [x] Golden's Phase 01 PR, when opened, gets a Gitar review with no further setup
