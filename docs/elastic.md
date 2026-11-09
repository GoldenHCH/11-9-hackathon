# Elasticsearch in KubeQuest

Elasticsearch Serverless is the only data store. Five indices, one inference endpoint, one hybrid query for people.

## Inference endpoint

Every `semantic_text` field uses the endpoint in `ELASTIC_INFERENCE_ID`.

- **Default:** `.jina-embeddings-v5-text-small`. Jina is the model family the Elastic team recommended for this track, it is served by Elastic itself so there is nothing to host, and the small variant keeps indexing fast enough for a hackathon clock.
- **Fallback:** `.multilingual-e5-small-elasticsearch`, a built-in multilingual endpoint. Set `ELASTIC_INFERENCE_ID` to it if the Jina endpoint is missing or throttled on the project.

Changing the endpoint after the indices exist means recreating them, because the endpoint is baked into each mapping. Delete the five indices, then run `npm run index-all` again.

## Indices

`ensureIndices()` creates any missing index when the api starts (it never blocks `listen` and retries in the background). `npm run index-all` calls it too.

| Index | `_id` | Notable fields |
|-------|-------|----------------|
| `talks` | session id | `title`, `abstract` text. `searchText` semantic_text (title + abstract, written at index time). `transcript` semantic_text (seeded talks only). `track`, `level`, `locationId`, `venue` keyword. `start`, `end` date. `geo` geo_point copied from the room |
| `attendees` | attendee id | `handle` keyword. `name`, `headline`, `profileText` text (BM25). `profileSemantic` semantic_text (same text as `profileText`, so BM25 and semantic can be fused). `profile.topics`, `profile.languages`, `profile.seniority` keyword. `profile.firstTimer`, `profile.welcomer`, `visible` boolean. `lastLocation` geo_point, `lastLocationId` keyword, `lastSeenAt` date. `xp` integer, `badges` keyword |
| `locations` | location id | `name` text. `kind`, `venue`, `floor` keyword. `geo` geo_point. QR tokens are never indexed |
| `xp_events` | event id | `attendeeId`, `type`, `talkId`, `locationId`, `introId` keyword. `xp` integer. `at` date |
| `intros` | intro id | `fromId`, `toId`, `status`, `meetingPointId` keyword. `proposedAt`, `slot.start`, `slot.end` date. `arrivals` nested (`attendeeId`, `at`) |

The mappings live in `app/src/es/es-mappings.helper.ts`.

## Loading the data

Reads `resources/*.json` (and `resources/transcripts/<talkId>.md` when present), copies each room's `geo` onto its talks, writes `searchText` and `profileSemantic`, and bulk-indexes in batches of 50 with a long request timeout, because `semantic_text` inference is slow. It is idempotent: ids are the record ids, so running it again overwrites.

```bash
cp .env.example .env
npm run index-all
```

It prints the document count per index at the end. It needs only environment variables, so it also runs as a one-shot Job in the cluster.

## Hybrid people query

Reciprocal rank fusion of BM25 (`multi_match` over headline, profile text and topics) and a semantic query on `profileSemantic`. Only visible attendees are searched.

```bash
set -a && source .env && set +a

curl -s "$ELASTIC_URL/attendees/_search" \
  -H "Authorization: ApiKey $ELASTIC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "size": 5,
    "_source": ["handle", "headline", "profile.topics"],
    "retriever": {
      "rrf": {
        "retrievers": [
          {
            "standard": {
              "query": {
                "multi_match": {
                  "query": "eBPF and platform engineering",
                  "fields": ["headline^2", "profileText", "profile.topics"]
                }
              },
              "filter": { "term": { "visible": true } }
            }
          },
          {
            "standard": {
              "query": {
                "semantic": { "field": "profileSemantic", "query": "eBPF and platform engineering" }
              },
              "filter": { "term": { "visible": true } }
            }
          }
        ],
        "rank_window_size": 50,
        "rank_constant": 20
      }
    }
  }'
```

Good results are platform and observability engineers who mention eBPF, upgrades or cluster operations, even when the exact words differ.

## Health

`GET /healthz` reports whether Elasticsearch is configured and reachable, the inference id and the document count of each index. It always answers 200 so a database outage never restarts the pod; read `status` (`ok` or `degraded`) instead.
