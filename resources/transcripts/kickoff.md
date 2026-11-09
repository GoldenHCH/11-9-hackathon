# Cloud Native Hackathon kickoff (summary)

Our own short summary of the kickoff themes for the WeMakeDevs Cloud Native Hackathon, Monday 9 November 2026, Salt Lake City, the day before KubeCon + CloudNativeCon North America 2026 opens. It is not a verbatim transcript.

## The challenge: make conferences easier

KubeCon is huge. A first-timer faces hundreds of sessions across two buildings, a showcase hall full of booths, and thousands of people they have never met. The kickoff asked teams to build something that makes the conference easier to navigate: finding the right talk, finding the right people, and actually meeting them. The best entries help someone on day one, not only power users.

## One day, one cluster per team

Every team gets its own Kubernetes cluster, a virtual cluster on shared hosts, where the team is cluster-admin. Deploys are GitOps: push to main and Argo CD syncs the team namespace. Each team has a fixed resource budget (2 CPU and 4 GiB of requests), so efficient workloads matter. The public URL for every team is routed to a single Service on port 80.

## The sponsors and what they bring

- **Elastic**: Elasticsearch on Elastic Cloud Serverless as the data layer. Semantic search with `semantic_text` and Jina embeddings, hybrid search that fuses keyword and vector results with reciprocal rank fusion (RRF), geo queries, aggregations, the inference API for language models, Agent Builder and Workflows.
- **Dash0**: observability built on OpenTelemetry. Send traces, metrics and logs over OTLP and follow a single request across services.
- **Radar**: Radar Cloud shows every team's cluster, its workloads, GitOps state, events and health checks, and exposes an MCP server so coding agents can observe and operate the cluster safely.
- **Gitar and Sonar**: code quality and AI code review on every pull request, with team-defined review rules.

## How projects are judged

Judges look for a working demo on the live URL, real use of the sponsor technologies rather than logos, clear observability of what the app is doing, and something an attendee would actually want to use tomorrow morning. Teams should show the deploy story: a commit, a sync, a healthy rollout.

## Practical advice from the kickoff

Ship the smallest end-to-end slice early, deploy it, then improve it. Keep secrets out of the public repo. Watch the resource budget: a pod over quota stays Pending. Demos are short, so rehearse the path a judge will take from scanning a QR code to seeing a result.
