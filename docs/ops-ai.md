# AI model layer (ops notes)

Code: `app/src/ai/`. Tools never call a model. They call `generateJson` or `chatPrompt` from here.

## How a call flows

1. `generateJson(purpose, prompt, validate, fallback)` opens span `ai.generate` with `kubequest.ai.purpose`, `kubequest.ai.provider`, `kubequest.ai.cache_hit`, `kubequest.ai.attempts`, `kubequest.ai.duration_ms`, and `kubequest.ai.inference_id` for the endpoint that answered.
2. In-memory cache (sha256 of purpose + prompt, 30 min TTL, 500 entries).
3. Kibana Agent Builder `POST {kibana}/api/agent_builder/converse` with agent `ELASTIC_AGENT_ID` (default `kubequest-writer`), 15 s timeout. A 401, 403 or 404 trips a 5 minute agent breaker.
4. Then the Elastic inference API `POST _inference/completion/{id}` for each id in `ELASTIC_COMPLETION_INFERENCE_ID` (comma-separated; default `.anthropic-claude-5-sonnet-completion,.gp-llm-v2-completion`), 8 s timeout, no client retry. A 401, 403 or 404 trips a 5 minute breaker for that id and moves to the next id. Any other error stops the chain.
5. The answer is parsed as JSON and checked by the zod-backed validator. One retry on invalid output.
   Each purpose has a time budget (`aiSettings.BUDGET_MS`, for example 1.5 s for a handshake question). When the budget runs out, an `AbortSignal` cancels the agent or inference request that is still running, and no later attempt starts. The span records `kubequest.ai.aborted`.
6. Deterministic `fallback()` otherwise. With every breaker open, calls go straight to the fallback with no added latency.

Each failure logs `status` and `reason` (Elasticsearch `error.type: error.reason`, or Kibana's message), and adds span event `ai.inference_error` with `inference_id`, `status`, `reason`. The key is never logged.

Kibana URL: `KIBANA_URL`, or `ELASTIC_URL` with `.es.` replaced by `.kb.`.

## Current state (checked 2026-11-09, 22:22 UTC, from a Job in the cluster)

`_has_privileges` for the app's key returns `true` for `feature_agentBuilder.all`, `feature_agentBuilder.read`, `feature_workflowsManagement.all` and `feature_actions.read` on `space:default`. Converse, tool and agent management, and Workflow updates all work. No extra grant is needed. The 403s below are from the morning, before those privileges were added.

## Diagnosis on 2026-11-09, morning (real calls with key `kube-quest-app`)

Key role descriptor `kubequest_app`: cluster `monitor`, `monitor_inference`, `manage_inference`; indices `talks`, `attendees`, `locations`, `xp_events`, `intros`, `quests` (`all`); applications `[]`.

| Call | Result | Cause |
|---|---|---|
| `GET _inference/_all` | 200, 42 endpoints | |
| `POST _inference/text_embedding/.jina-embeddings-v5-text-small` | 200 | EIS embeddings are entitled |
| `POST _inference/completion/{id}` for every completion endpoint (claude-5 and 4.5 sonnet, gp-llm-v2, kimi-k3, nemotron 3 nano and 3.5 lightning, qwen-3.8, glm-5.3) | 403 `status_exception`: `Received an unsuccessful status code for request from inference entity id [...] status [403]. Error message: [Forbidden]` | Upstream EIS refuses the LLM. Elasticsearch already authorized the key: `_has_privileges` returns `manage_inference: true`, `monitor_inference: true` |
| `POST _inference/chat_completion/{id}/_stream` (claude-5 sonnet, gp-llm-v2, nemotron nano, `.rainbow-sprinkles-elastic`) | 403 SSE `error.code: forbidden`, same upstream message | Same |
| `GET /api/agent_builder/agents`, `POST /api/agent_builder/converse` | 403 `API [...] is unauthorized for user, this action is granted by the Kibana privileges [agentBuilder:read]` | Key has no Kibana application privileges |
| `GET /api/actions/connectors` | 403 | Same |

Conclusion: there are two independent blockers. (1) The project's Elastic Inference Service does not grant LLM (completion or chat) access for this Serverless project; embeddings work. A new key will not fix this, because the 403 comes from EIS after Elasticsearch has authorized the request. (2) Agent Builder needs Kibana application privileges, which our key lacks. Agent Builder runs its model through the same EIS LLM connector, so it also needs (1) fixed before it can answer.

## To turn on the model

### 1. EIS LLM access (blocks both paths)

Ask the Elastic table to enable EIS LLM / chat models for the project (or check the project's billing / trial tier in Elastic Cloud). No code change is needed. Verify with:

`POST _inference/completion/.anthropic-claude-5-sonnet-completion` with body `{"input":"Reply with {\"ok\":true}"}`. It must return 200.

To prefer other models, set `ELASTIC_COMPLETION_INFERENCE_ID` to a comma-separated list, for example `.gp-llm-v2-completion,.anthropic-claude-5-sonnet-completion`.

### 2. Agent Builder key (the human mints it; agents do not)

In Kibana Dev Tools, signed in as a project admin, run `POST /_security/api_key` with:

```json
{
  "name": "kube-quest-app-v2",
  "role_descriptors": {
    "kubequest_app": {
      "cluster": ["monitor", "monitor_inference", "manage_inference"],
      "indices": [
        { "names": ["talks", "attendees", "locations", "xp_events", "intros", "quests"], "privileges": ["all"] }
      ],
      "applications": [
        {
          "application": "kibana-.kibana",
          "privileges": ["feature_agentBuilder.all", "feature_actions.read"],
          "resources": ["*"]
        }
      ]
    }
  }
}
```

`feature_agentBuilder.all` grants `agentBuilder:read` (converse, list agents) and `agentBuilder:manageAgents` (create the agent). `feature_actions.read` lets Agent Builder use the EIS connector. Use `resources: ["space:default"]` instead of `["*"]` to limit it to the default space.

Then:

1. Put the new `encoded` value in `.env` as `ELASTIC_API_KEY` and in the `app-credentials` Secret (through Radar; never in git or a log).
2. Run `ensureKubequestAgent()` from `app/src/ai/agent-builder.ts` once. It creates or updates the ES|QL tools `kubequest.upcoming_talks` and `kubequest.people_like`, and agent `kubequest-writer` with those tools.
3. `ELASTIC_AGENT_ID=kubequest-writer` is set in `deploy/deployment.yaml` (and is the default in code).
4. Check the `ai.generate` span: `kubequest.ai.provider` should be `agent_builder` or `inference`, not `fallback`.

Agent ids created: none yet (blocked by privileges).
