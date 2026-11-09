# KubeQuest operations

## Secret `app-credentials`

The Deployment reads every sensitive value from the Secret `app-credentials` in namespace `team-kube-quest` (`envFrom.secretRef`). The Secret is not in git: the repo is public. Create and change it through Radar (MCP `apply_resource`, or Radar Cloud), never in a commit, a manifest or a log.

Keys (names only):

| Key | Required | Used by |
|-----|----------|---------|
| `ELASTIC_URL` | yes | Elasticsearch client |
| `ELASTIC_API_KEY` | yes | Elasticsearch client |
| `ELASTIC_INFERENCE_ID` | yes | `semantic_text` embeddings |
| `ELASTIC_COMPLETION_INFERENCE_ID` | no | quiz and icebreaker completions; comma-separated inference ids tried in order (see `docs/ops-ai.md`) |
| `KIBANA_URL` | no | Agent Builder |
| `ELASTIC_AGENT_ID` | no | Agent Builder |
| `QR_SECRET` | yes | HMAC signing of check-in tokens |
| `DASH0_AUTH_TOKEN` | yes, for Dash0 | the OpenTelemetry Collector's exporter |
| `DASH0_ENDPOINT` | yes, for Dash0 | the OpenTelemetry Collector's exporter |
| `DASH0_TRACE_URL_TEMPLATE` | no | links from XP events to traces |
| `DASH0_RUM_ENDPOINT`, `DASH0_RUM_AUTH_TOKEN` | no | browser RUM |

Non-secret settings (`TEAM_NAME`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318`, `DEPLOYMENT_ENVIRONMENT`, `K8S_*`) are plain `env` in `deploy/deployment.yaml`.

## Adding the Dash0 keys

1. In Dash0, create an auth token with ingest permission (Settings > Auth Tokens) and note the OTLP/HTTP ingest endpoint for your region.
2. Ask the agent to add `DASH0_AUTH_TOKEN` and `DASH0_ENDPOINT` to the existing `app-credentials` Secret through the Radar MCP server. Read the live Secret first and keep every existing key: the patch adds two keys, it doesn't replace the Secret. Paste the values into the Radar UI or the prompt; the agent must not echo them back.
3. The collector in `deploy/` reads both keys from `app-credentials` as env vars. Restart it so it picks them up (`manage_workload` restart on the collector Deployment), then restart `app`.
4. Check: call any tool, then look for a `tool.<name>` span from service `kubequest-app` in Dash0.

## Dash0 trace links

Every XP event in Elasticsearch (`xp_events`) stores the `traceId` of the request that awarded it. The link to that trace:

```
https://app.dash0.com/goto/traces?trace_id=<traceId>
```

TO VERIFY: confirm this URL shape opens the trace in our Dash0 organization before the demo. If it doesn't, put the working shape in `DASH0_TRACE_URL_TEMPLATE` (with `{traceId}` as the placeholder) instead of changing code.

## Printing QR codes

Every location has a printed QR block. It encodes the scan URL:

```
https://kube-quest.cnh.radarhq.io/r/<locationId>?t=<token>
```

`t` is an HMAC token signed with `QR_SECRET` (`app/src/security/tokens.ts`, `signLocationToken` and `buildScanUrl`). Printed tokens don't expire. Room screens use `GET /api/screen-token/:locationId`, which returns a short-lived token and its `scanUrl`.

To print a sheet, after `npm run index-all` and with `app/.env` loaded, get one scan URL per location and turn each into a PNG:

```bash
cd app
npx tsx -e "import('./src/security/tokens').then(t => { for (const id of process.argv.slice(1)) console.log(id, t.buildScanUrl(id, t.signLocationToken(id))) })" hall-a room-251 campfire-1 > ../qr-urls.txt
npx qrcode -o ../qr/<locationId>.png "<scanUrl>"
```

Run the `qrcode` line once per row of `qr-urls.txt`, then lay the PNGs out with the location name under each code. Keep `qr-urls.txt` and the PNGs out of git: a printed token is a credential for that location. A changed `QR_SECRET` invalidates every printed code.

## Day-to-day

- Deploy: push to `main`; the `build-and-deploy` Action builds the image and commits `deploy: <sha> [skip ci]`; Argo CD syncs `deploy/`.
- Health: `GET /healthz` (process) and `GET /readyz` (Elasticsearch reachable).
- Debug: Radar `diagnose` on `app` in `team-kube-quest`, then the trace in Dash0.
