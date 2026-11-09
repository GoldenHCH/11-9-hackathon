# KubeQuest conventions

The full rules are in `AGENTS.md` and `rules/`. These are the ones worth flagging in review.

## Architecture

- `app/src/tools/` is the only module that touches data. The UI, the assistant, the MCP server and the CronJob all call tools; none of them call Elasticsearch directly.
- No model call inside `app/src/tools/`. Tools are deterministic; models live in the assistant layer.
- Every tool emits an OpenTelemetry span.
- Every route that awards XP emits a span with the attribute `kubequest.xp.awarded` set to the points awarded.

## TypeScript

- No comments in TypeScript code. Names should carry the meaning.
- Every file ends with a newline.
- Model prompts live in `*.constants.ts` files, not inline in logic.
- Shared types live in one place and are imported, not redeclared.

## Hackathon scope

This is a one-day hackathon build. Do not ask for unit tests, broad refactors or abstractions for future features. Focus findings on bugs, security holes and broken demo paths.
