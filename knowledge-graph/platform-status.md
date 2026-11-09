# Platform status

What is verified live, as of **13:20 MST, Nov 9 2026**. Checked from Radar MCP, GitHub and the team URL, not from memory. Update the time when you re-check.

## Identifiers

- **Team name:** `kube-quest` (hyphen). The first attempt, `kubequest`, failed on Radar's side; its status page still shows the failure and should be ignored.
- **Radar cluster:** name `kube-quest`, id `iHuUh5rOFPU`, organization "Cloud Native Hackathon". Pass this id as `cluster` on every Radar MCP call.
- **Namespace:** `team-kube-quest`. **URL:** `https://kube-quest.cnh.radarhq.io`.
- **Image:** `ghcr.io/goldenhch/11-9-hackathon:<sha>`, public. Set by the `build-and-deploy` Action in `deploy/kustomization.yaml`.
- **Secret** `app-credentials` in the namespace, keys: `ELASTIC_URL`, `ELASTIC_API_KEY`, `ELASTIC_INFERENCE_ID`, `QR_SECRET`, `OTEL_SERVICE_NAME`. No Dash0 keys yet. Values live only there and in local `.env` files.

## The PRD's 12:15 gate, scored

| Gate item | State | Evidence |
|-----------|-------|----------|
| Team URL shows the latest commit SHA | Yes | `/healthz` reports `version: 47e596e`, the Phase 01 merge |
| Radar shows the app healthy | Yes | Deployment `app` 2/2, zero issues in the namespace |
| Collector pod healthy | **No** | No collector in `deploy/`; Phase 04 not started |
| Dash0 shows a trace | **No** | No SDK, no collector, no Dash0 token in the Secret |
| At least 2 Gitar-reviewed PRs merged | Yes | PRs 1, 2 and 3 all have Gitar reviews |
| Five Elastic indices exist and a semantic smoke test hits | **Unknown** | The deployed app reports `elasticsearch.configured: false` |

## Gaps that block rubric lines

1. **The Deployment does not mount `app-credentials`.** `deploy/deployment.yaml` has no `envFrom`, so the pods run without `ELASTIC_URL` and every tool serves the in-memory seed. Fix: add `envFrom: [{ secretRef: { name: app-credentials } }]` and push. Then run `index-all` once (one-shot Job from the app image, see `docs/elastic.md`) and confirm `/healthz` shows five index counts.
2. **Phase 04 has no owner while Collin is on the UI.** Collector manifest, Node SDK, JSON logs with trace ids, Dash0 token in the Secret. The PRD's collector config (in [[prd-kubequest]], "Setup runbook" step 2) is a ready starting point.
3. **Gitar requested changes on PR 3 and it was merged anyway.** Two findings: `check_in` awards XP with no token check and no dedup; `quiz_for_talk` returns the correct answer to the client. Both are the first PR of Phase 02 (`plans/phase-02-tools.md`, section 1). Keep the review link: it is the first frame of the security story.
4. **Gitar auto-apply is off** for the repo. Turn it on before the first code PR of Phase 02 so the "auto-apply" rubric line has evidence.

## What is done

- Phase 00: cnh-starter merged in place, team set up, hello app live through Argo CD.
- Phase 01: shared types, five mappings, schedule ingest (300 sessions), locations with geo, ~150 seeded attendees, XP and intro seeds, all ten tools with real logic over the seed store, fixtures for the UI, Angular scaffold. Merged as PR 3.
- Plans for Phase 02 and 03 merged as PR 2.

Related: [[prd-kubequest]].
