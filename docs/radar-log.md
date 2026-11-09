# Radar log

What we did on the cluster through Radar, in order. This feeds the 5:30 demo story.

## 1. Cluster setup: `kubequest` failed, recreated as `kube-quest`

The first team cluster, `kubequest`, did not finish provisioning on Radar's side, so the app never came up in `team-kubequest`. We joined again as **`kube-quest`**: vcluster `kube-quest`, namespace `team-kube-quest`, public URL https://kube-quest.cnh.radarhq.io. The repo was moved over in commit `24c9a04` ("move team to kube-quest after kubequest cluster setup failed"). Every Radar call since passes the `kube-quest` cluster id.

## 2. Argo CD Application applied from the Radar Cloud UI

We applied `argocd/application.yaml` (Application `app` in `team-kube-quest`, source `deploy/` on `main`, automated sync with prune and self-heal) from the Radar Cloud UI. Before applying, we reviewed the dry-run diff in Radar: it created the Application and took over the starter Deployment, Service and HTTPRoute. From then on every push to `main` deploys.

## 3. `app-credentials` created and extended through the Radar MCP server

From Claude Code, through the Radar MCP server, we created the Secret `app-credentials` in `team-kube-quest` with the Elasticsearch keys and `QR_SECRET`, then extended it with more keys as features landed (see [`ops.md`](ops.md) for the key list). Each change read the live Secret first and kept the existing keys. Values never went into git, a commit message or the agent's output. Argo CD doesn't own this Secret, so self-heal leaves it alone.

## 4. Next entries

- Radar Checks: the "before" screenshot, the findings we fixed, and the "after".
- An AI investigation on a real symptom, with the evidence it found and what we changed.
- Each release: synced revision, image tag and rollout health.
