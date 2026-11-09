# Platform status

What is verified live, as of **13:42 MST, Nov 9 2026**. Checked from Radar MCP, GitHub and the team URL, not from memory. Update the time when you re-check.

## Identifiers

- **Team name:** `kube-quest` (hyphen). The first attempt, `kubequest`, failed on Radar's side; its status page still shows the failure and should be ignored.
- **Radar cluster:** name `kube-quest`, id `iHuUh5rOFPU`, organization "Cloud Native Hackathon". Pass this id as `cluster` on every Radar MCP call.
- **Namespace:** `team-kube-quest`. **URL:** `https://kube-quest.cnh.radarhq.io`.
- **Image:** `ghcr.io/goldenhch/11-9-hackathon:<sha>`, public. Set by the `build-and-deploy` Action in `deploy/kustomization.yaml`.
- **Secret** `app-credentials` in the namespace, keys: `ELASTIC_URL`, `ELASTIC_API_KEY`, `ELASTIC_INFERENCE_ID`, `QR_SECRET`, `OTEL_SERVICE_NAME`. No Dash0 keys yet. Values live only there and in local `.env` files.

## The PRD's 12:15 gate, scored

| Gate item | State | Evidence |
|-----------|-------|----------|
| Team URL shows the latest commit SHA | Yes | `/healthz` reports `version: 79c99a0` (PR 7 merge); Application `app` Synced at deploy commit `2c06711`, Healthy |
| Radar shows the app healthy | Yes | Deployment `app` 2/2 on `79c99a0` |
| Collector pod healthy | Yes | Deployment `otel-collector` 1/1 Running (`otel/opentelemetry-collector-contrib:0.120.0`), added by PR 5 |
| Dash0 shows a trace | **Unverified** | SDK and collector are deployed; nobody has checked Dash0 for a trace yet |
| At least 2 Gitar-reviewed PRs merged | Yes | PRs 1, 2 and 3 all have Gitar reviews; Gitar also approved PR 4 (closed as superseded by PR 5) |
| Five Elastic indices exist and a semantic smoke test hits | Yes | `/readyz` says `elasticsearch: reachable`. Counts from a one-shot Job: talks 27, attendees 20, locations 39, xp_events 111, intros 1, quests 9. The hybrid RRF people query (BM25 + `semantic` on `profileText`, Jina endpoint) returns 20 hits, eBPF SRE first |

## Gaps that block rubric lines

1. **Resolved: Elasticsearch is connected and seeded; the image's `index-all` is still broken.** PR 5 mounted `app-credentials` with `envFrom` (PR 4 did the same and was closed). The seed (27 talks, 17 attendees, 39 locations, 102 xp events) was loaded at 13:40 by Job `index-all-79c99a0-003`. The bundled `scripts/dist/index-all.js` in the image has two bugs, so `node scripts/dist/index-all.js` alone exits 0 and indexes nothing:
   - `scripts/seed.ts` resolves `resources/` from `__dirname`, which is `scripts/dist` in the bundle.
   - Its `require.main === module` guard is true inside the bundle, so its own `main` runs and closes the client.
   The Job worked around both in a `/tmp` copy; see `docs/radar-log.md` section 4. The new script has no intros step (`intros.seed.json` has 14 entries, but none are indexed), and `resources/` has no quests seed file, and `docs/elastic.md` still describes the old mapping (`profileSemantic`, five indices) and a `/healthz` that reports counts (it now lives in `/readyz`, without counts).
2. **Phase 04 has no owner while Collin is on the UI.** Collector manifest, Node SDK, JSON logs with trace ids, Dash0 token in the Secret. The PRD's collector config (in [[prd-kubequest]], "Setup runbook" step 2) is a ready starting point.
3. **Gitar requested changes on PR 3 and it was merged anyway.** Two findings: `check_in` awards XP with no token check and no dedup; `quiz_for_talk` returns the correct answer to the client. Both are the first PR of Phase 02 (`plans/phase-02-tools.md`, section 1). Keep the review link: it is the first frame of the security story.
4. **Gitar auto-apply is off** for the repo. Turn it on before the first code PR of Phase 02 so the "auto-apply" rubric line has evidence.

## What is done

- Phase 00: cnh-starter merged in place, team set up, hello app live through Argo CD.
- Phase 01: shared types, five mappings, schedule ingest (300 sessions), locations with geo, ~150 seeded attendees, XP and intro seeds, all ten tools with real logic over the seed store, fixtures for the UI, Angular scaffold. Merged as PR 3.
- Plans for Phase 02 and 03 merged as PR 2.

Related: [[prd-kubequest]].
