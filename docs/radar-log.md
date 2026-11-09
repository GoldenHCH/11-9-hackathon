# Radar log

What we did on the cluster through Radar, in order. This feeds the 5:30 demo story.

## 1. Cluster setup: `kubequest` failed, recreated as `kube-quest`

The first team cluster, `kubequest`, did not finish provisioning on Radar's side, so the app never came up in `team-kubequest`. We joined again as **`kube-quest`**: vcluster `kube-quest`, namespace `team-kube-quest`, public URL https://kube-quest.cnh.radarhq.io. The repo was moved over in commit `24c9a04` ("move team to kube-quest after kubequest cluster setup failed"). Every Radar call since passes the `kube-quest` cluster id.

## 2. Argo CD Application applied from the Radar Cloud UI

We applied `argocd/application.yaml` (Application `app` in `team-kube-quest`, source `deploy/` on `main`, automated sync with prune and self-heal) from the Radar Cloud UI. Before applying, we reviewed the dry-run diff in Radar: it created the Application and took over the starter Deployment, Service and HTTPRoute. From then on every push to `main` deploys.

## 3. `app-credentials` created and extended through the Radar MCP server

From Claude Code, through the Radar MCP server, we created the Secret `app-credentials` in `team-kube-quest` with the Elasticsearch keys and `QR_SECRET`, then extended it with more keys as features landed (see [`ops.md`](ops.md) for the key list). Each change read the live Secret first and kept the existing keys. Values never went into git, a commit message or the agent's output. Argo CD doesn't own this Secret, so self-heal leaves it alone.

## 4. Elasticsearch connected and seed data indexed

- 13:26 `list_clusters`: `kube-quest` is still `iHuUh5rOFPU`. Used that id on every call below.
- 13:27 `get_resource` Application `app`: Synced at `a45b2ed`, Healthy, image `47e596e`, no syncOptions; `/healthz` said `configured: false`. Took this as the before state for mounting `app-credentials`.
- 13:36 `manage_gitops` sync `app`: "operation already in progress", because Argo CD was already auto-syncing `1a4eec3` (PR #5, which carried the same `envFrom`). Closed PR #4 as superseded instead of merging it.
- 13:36 `wait_for` Deployment `app`: rolled out 2/2. `/healthz` then said `configured: true, reachable: true`, so the Secret mount was done.
- 13:38 `manage_gitops` sync `app`, then `list_resources` pods and `wait_for`: Synced at `2c06711`, both pods on `79c99a0`, healthy. Used `79c99a0` as the image for the index Jobs.
- 13:39 `apply_resource` Job `index-all-79c99a0-001`, then `get_workload_logs`: Complete, but "no seed file in resources/" for every index. The bundled script resolves `resources/` from `scripts/dist`, so it found nothing. Reran it from a copy with `resources/` linked beside it.
- 13:39 Job `index-all-79c99a0-002`: attendees 17 and xp_events 102 indexed, then "There are no living connections". `seed.ts`'s own `require.main` guard is true inside the bundle, so it ran and closed the client. Reran with that guard patched in the copy.
- 13:40 Job `index-all-79c99a0-003`: locations 39, talks 27, attendees 17, xp_events 102, 0 failed. Seed data loaded; the source fix for both bundle bugs is still open.
- 13:41 Job `es-verify-79c99a0-001`: counts talks 27, attendees 20, locations 39, xp_events 111, intros 1, quests 9; the hybrid RRF people query returned 20 hits with the eBPF SRE first. Jina semantic search works, so the e5 fallback is not needed.

## 5. Next entries

- Radar Checks: the "before" screenshot, the findings we fixed, and the "after".
- An AI investigation on a real symptom, with the evidence it found and what we changed.
- Each release: synced revision, image tag and rollout health.
