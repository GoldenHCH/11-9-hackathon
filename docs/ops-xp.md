# XP, levels, banners: ops notes

## Writer

`app/src/xp/award.ts` `awardXp` / `awardXpDetailed` is the only writer to `xp_events`.

One award does:

1. Painless update on `attendees/<id>`. The script source is fixed and every value is passed as `params`. It adds XP, sets `level` from thresholds (Pod 0, Deployment 50, Node 200, Cluster 450, Control Plane 800) and increments `inventory.blocks.<material>`, `inventory.gems` and the live counters `inventory.handshakes|welcomes|outposts`.
2. Index the event into `xp_events` with `at`, plus the active `traceId`/`spanId`, so Dash0 traces join the ledger.
3. Counter `kubequest.xp.awarded{kubequest.xp.type}`, span `xp.award` with `kubequest.xp.awarded`.
4. Banners from the counters the update returned: Observability Nerd (3 glass), Connector (3 handshakes), Welcomer (2 welcome events). Each new banner writes a 0 XP `badge` event with id `<attendee>:badge:<banner>` (`op_type: create`, so it cannot double-award) and appends the banner to `attendees.banners` once.
5. `completeQuestsFor(event)`. While that is a stub (501), it returns `[]`.

There is no `refresh: wait_for`. On serverless it added about 5s per award. Reads use the realtime attendee doc, merged with the ledger aggregation (`summarizeLedger`).

## Inventory tool

`inventory` returns level progress, xp, `nextLevelXp`, blocks per material (gold included), gems and banner progress. It takes the max of the ledger aggregation and the live attendee counters, and `earnedAt` comes from the badge events.

## Elastic Workflow

`resources/workflows/banners.yaml` is the same banner rules as a Kibana Workflow (`POST <kibana>/api/workflows` with `{ "yaml": ... }`). Creating it on 2026-11-09 returned 403: the current API key lacks `workflowsManagement:create`. To load it, use a key with that privilege, or paste the YAML into Kibana > Workflows. Its schema has not been validated by Kibana yet. The code path stays the source of truth. The workflow uses the same deterministic badge ids, so the two can run side by side.

## Smoke check

`cd app && npx tsx src/xp/xp-smoke.ts` creates a throwaway attendee, awards 3 glass check-ins, 3 handshakes and 2 welcomes, prints the inventory, then deletes everything it wrote.
