# KubeQuest security review

KubeQuest awards points (XP) for physical actions at a conference: QR check-ins at locations, talk quizzes and verified handshakes. Anything that lets a user earn XP without doing the action is a real bug. Flag it as a security finding, not a style nit.

## Check-in and XP awards

- Every check-in route must verify the HMAC signature on the QR token before awarding XP. A route that trusts a location id, attendee id or point value taken straight from the URL, query string or body is a finding.
- When a token carries an expiry, the route must reject expired tokens.
- One scan per attendee per location per hour. A check-in that can be replayed to award XP twice inside that window is a finding.
- Handshakes award XP only when both attendees confirmed. One side alone must never award points.
- The HMAC key comes from the environment (the `app-credentials` Secret). It is never hard-coded, logged, or returned in a response.
- `check_in` must verify signed tokens. The `check_in` tool (and any campfire or meet arrival) calls `verifyLocationToken` and stops when the check fails. A code path that skips the check, catches its failure and carries on, or accepts an unsigned or mismatched location id is a finding.

## The XP ledger

- `awardXp` (with `awardXpDetailed`, both in `app/src/xp/award.ts`) is the only writer to the `xp_events` index. Any other code that indexes, updates, bulk-writes or deletes documents in `xp_events`, or changes an attendee's XP total directly, is a finding.
- Every XP event stores the `traceId` of the request that awarded it.

## Hallway privacy

- Never expose a player's `photoUrl` or `spotMe` (the photo and "how to spot me" line) before a mutual accept. Those fields go only to the confirmed partner of a meet both sides accepted. A tool, search result, leaderboard row, recommendation or meet proposal that returns them earlier, or to anyone else, is a finding.

## Secrets

- No secrets in code, manifests, workflow files, fixtures or committed `.env` files. That covers Elasticsearch API keys, Dash0 tokens, OpenAI keys, the HMAC key and kubeconfigs.
- Everything sensitive is read from environment variables backed by the `app-credentials` Kubernetes Secret, which is not in git.
- The repository is public. Treat any committed credential as leaked.

## Elasticsearch

- Elasticsearch on Elastic Cloud Serverless is the only datastore. Flag a new database, cache or file store.
- Every Elasticsearch call sets a request timeout.
- User input never goes into a Painless script source, a script id, or a raw query string. Pass it as script `params` or inside typed query clauses.
- Queries over attendee data return only the fields the caller needs. Do not return emails or other personal fields to other attendees.

## Kubernetes

- No privileged containers, `hostPath`, `hostNetwork` or `hostPID`. The cluster refuses them.
- Every container sets CPU and memory requests and limits.
- No Service of type `LoadBalancer` or `NodePort`.
