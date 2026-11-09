# Elasticsearch in KubeQuest

Elasticsearch Serverless is the only data store. Nine indices, one embedding endpoint (Jina), one rerank endpoint (Jina), hybrid RRF retrievers wrapped in a reranker, an Agent Builder agent with ES|QL tools, and one Workflow.

## Inference endpoint

Every `semantic_text` field uses the endpoint in `ELASTIC_INFERENCE_ID`.

- **Default:** `.jina-embeddings-v5-text-small`. Jina is the model family the Elastic team recommended for this track, it is served by Elastic itself so there is nothing to host, and the small variant keeps indexing fast enough for a hackathon clock.
- **Fallback:** `.multilingual-e5-small-elasticsearch`, a built-in multilingual endpoint. Set `ELASTIC_INFERENCE_ID` to it if the Jina endpoint is missing or throttled on the project.

Changing the endpoint after the indices exist means recreating them, because the endpoint is baked into each mapping. Delete the indices that have `semantic_text` fields (`talks`, `attendees`, `locations`), then run `npm run index-all` again.

## Indices

`ensureIndices()` creates any missing index when the api starts (it never blocks `listen` and retries in the background). `npm run index-all` calls it too.

| Index | `_id` | Notable fields |
|-------|-------|----------------|
| `talks` | session id | `title`, `abstract` text. `searchText` semantic_text (title + abstract, written at index time). `transcript` semantic_text (seeded talks only). `track`, `level`, `locationId`, `venue` keyword. `start`, `end` date. `geo` geo_point copied from the room |
| `attendees` | attendee id | `handle` keyword. `headline`, `workingOn`, `summary`, `asks`, `offers` text (BM25). `profileText` semantic_text (headline, working-on and topics in one string, rebuilt when the profile changes). `profile.topics` keyword. `profile.firstTimer`, `profile.welcomer`, `visible`, `settings.meetingOn` boolean. `lastLocation` geo_point, `lastLocationId` keyword, `lastSeenAt` date. `xp`, `level` integer, `banners` keyword. `email`, `realName` are stored but never returned by search or the agent's tools |
| `locations` | location id | `name`, `description`, `askAbout` text. `kind`, `building`, `level`, `room`, `topics` keyword. `searchText` semantic_text. `geo` geo_point. QR tokens are never indexed |
| `xp_events` | event id | `attendeeId`, `type`, `talkId`, `locationId`, `introId` keyword. `xp` integer. `at` date |
| `intros` | intro id | `fromId`, `toId`, `status`, `meetingPointId` keyword. `proposedAt`, `slot.start`, `slot.end` date. `arrivals` nested (`attendeeId`, `at`) |
| `quests` | quest id | Quest offers and their status per attendee |
| `handshakes` | handshake id | Verified in-person handshakes (code, question, answer, status) |
| `booth_notes` | note id | Notes players save at sponsor booths |
| `messages` | message id | Hallway messages between matched players |

The mappings live in `app/src/es/index-mappings.ts`.

## Loading the data

Reads `resources/*.json` (and `resources/transcripts/<talkId>.md` when present), copies each room's `geo` onto its talks, writes `searchText` and `profileText`, and bulk-indexes in batches of 100 with a long request timeout, because `semantic_text` inference is slow. It is idempotent: ids are the record ids, so running it again overwrites.

```bash
cp .env.example .env
npm run index-all
```

It prints the document count per index at the end. Before it touches Elasticsearch it checks that `sessions.json`, `locations.json`, `attendees.seed.json`, `xp-events.seed.json` and `intros.seed.json` exist and are non-empty JSON arrays; if any is missing it lists the problems and exits with code 1 instead of indexing nothing.

### As a one-shot Job

The app image ships a compiled copy of the script (`npm run build:scripts` bundles it to `scripts/dist/index-all.js` during the image build) and the `resources/` folder, so a Kubernetes Job can reuse the app image and run:

```bash
node scripts/dist/index-all.js
```

The container needs only environment variables: `ELASTIC_URL`, `ELASTIC_API_KEY` and, optionally, `ELASTIC_INFERENCE_ID`, for example from the `app-credentials` Secret with `envFrom`. The working directory in the image is `/repo`, where the script finds `resources/`.

## Hybrid people query, reranked

Reciprocal rank fusion of BM25 (`multi_match` over headline and working-on, plus topic boosts) and a semantic query on `profileText`, wrapped in a `text_similarity_reranker` that rescores the top 20 with `.jina-reranker-v3`. Only visible attendees are searched. The app runs the same shape in `app/src/match/people.ts`, with fallbacks (see below).

```bash
set -a && source .env && set +a

curl -s "$ELASTIC_URL/attendees/_search" \
  -H "Authorization: ApiKey $ELASTIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "size": 5,
    "_source": ["handle", "headline", "profile.topics"],
    "retriever": {
      "text_similarity_reranker": {
        "retriever": {
          "rrf": {
            "retrievers": [
              {
                "standard": {
                  "query": {
                    "multi_match": {
                      "query": "eBPF and platform engineering",
                      "fields": ["workingOn^2", "headline"]
                    }
                  },
                  "filter": { "term": { "visible": true } }
                }
              },
              {
                "standard": {
                  "query": {
                    "semantic": { "field": "profileText", "query": "eBPF and platform engineering" }
                  },
                  "filter": { "term": { "visible": true } }
                }
              }
            ],
            "rank_window_size": 50,
            "rank_constant": 20
          }
        },
        "field": "profileText",
        "inference_id": ".jina-reranker-v3",
        "inference_text": "eBPF and platform engineering",
        "rank_window_size": 20
      }
    }
  }'
```

Good results are platform and observability engineers who mention eBPF, upgrades or cluster operations, even when the exact words differ.

## Jina reranker

Rerank endpoint: `.jina-reranker-v3`, served by Elastic (override with `ELASTIC_RERANK_INFERENCE_ID`). `GET _inference/rerank` on the project also lists `.jina-reranker-v3.5`, `.jina-reranker-v2-base-multilingual` and `.jina-reranker-m0`; v3 and v3.5 rank the same top results on our data and add about 150 ms.

`app/src/es/rerank.ts` wraps an `rrf` retriever in a `text_similarity_reranker` over the top 20 and runs a chain of attempts: reranked, then plain RRF, then lexical. A 4xx from the rerank endpoint turns reranking off for five minutes. The chosen mode is on the active span (`kubequest.<label>.mode`).

| Caller | Reranked field | When |
|--------|----------------|------|
| `recommend_talks`, `whats_next` (`match/talks.ts`) | `talks.searchText` | Always |
| `recommend_people` (`match/people.ts`) | `attendees.profileText` | Always |
| `search` (`match/search.ts`) | `searchText` or `profileText` | Only when the search is limited to sessions or to players. A `text_similarity_reranker` drops documents that lack its field, so a mixed search across talks, players and places stays on RRF |

## Agent Builder: a grounded agent

Agent `kubequest-writer` (`ELASTIC_AGENT_ID`, default in code) has two custom ES|QL tools, defined in `app/src/ai/agent-builder.ts`:

- `kubequest.upcoming_talks(after, interest)`: `FROM talks` where `start >= after` and `MATCH(searchText, interest)` (Jina semantic match), top 20, then ES|QL `RERANK` with `.jina-reranker-v3` on title and abstract, top 5. Returns ids, titles, rooms and times only, never transcripts or quiz answers.
- `kubequest.people_like(interest)`: `FROM attendees` where `visible` and `settings.meetingOn` and `MATCH(profileText, interest)`. Returns handle, headline, working-on and topics only, never names or emails.

The agent's instructions say: use the talks tool for schedule questions and the people tool for people questions, and recommend only what the tools returned. For writing tasks (icebreakers, quizzes, rephrasing) it answers without tools.

`ensureKubequestAgent()` creates or updates both tools and the agent. Run it after changing them.

The live flow is the `ask_guide` tool ("Ask the guide" on the Here page). It sends the player's topics to the agent, which calls `kubequest.upcoming_talks` once. The app then checks every talk id the agent returns against the `talks` index and drops any it can't find. If the agent hasn't answered after 10 s, the tool returns the reranked `recommend_talks` picks with `pending: true` and keeps the agent call running (30 s cap). The answer is cached for 10 minutes, so the client's retry a few seconds later gets the grounded picks. The `ai.guide_next` span records the tool calls, the number of dropped ids and the provider.

## Workflow: banners

`resources/workflows/banners.yaml` is the Kibana Workflow `kubequest-banners` (API: `PUT /api/workflows/workflow/kubequest-banners` with `{ "yaml": ... }`, run with `POST /api/workflows/workflow/kubequest-banners/run` and `{ "inputs": { "attendeeId": ... } }`). It aggregates one attendee's ledger, and for each banner reached it appends the banner to `attendees.banners` with the same idempotent script the app uses. It never writes to `xp_events`: `awardXp` is the only ledger writer (game-integrity rule 2). The app treats a banner that is already on the profile as earned. `awardDueBanners` also appends the banner when a badge event already exists, for example one written by an older version of this Workflow. So whichever runs first, the profile ends up with the banner, and nobody gets it twice.

## Health

`GET /healthz` reports whether Elasticsearch is configured and reachable, the inference id and the document count of each index. It always answers 200 so a database outage never restarts the pod; read `status` (`ok` or `degraded`) instead.
