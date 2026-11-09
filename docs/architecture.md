# KubeQuest architecture

One Node image. Express API (`app/`, TypeScript) serves the Angular build from `app/public`. Elasticsearch Serverless is the only data store. OpenTelemetry goes to the in-namespace collector, then Dash0. Argo CD deploys `deploy/` into `team-kube-quest`.

## Request path

```
UI / assistant / MCP / CronJob
  -> POST /api/tools/:name        (app/src/http/api.routes.ts)
  -> toolRegistry[name].execute   (app/src/tools/index.ts)
  -> defineTool: zod parse, span tool.<name>, kubequest.* attributes, kubequest.xp.awarded
  -> tool run -> es/*, xp/*, security/*, match/*, quests/*, meet/*, ai/*
```

Other routes: `GET /healthz`, `GET /readyz` (pings Elasticsearch), `GET /api/config`, `GET /api/tools` (tool list with JSON schemas), `GET /api/screen-token/:locationId` (screen_token), `GET /r/:locationId?t=` (QR landing: SPA or JSON hint), `GET /h/:token` (handshake QR landing: SPA or JSON hint), `GET /api/recap/:attendeeId/email.html` (the recap email as HTML).

## File to lane map

| Path | Lane | What |
|------|------|------|
| `app/src/server.ts`, `app.ts`, `config.ts`, `otel.ts` | foundation | boot, middleware, env, OTel SDK (loaded first) |
| `app/src/http/*` | foundation | api, health, web, SPA fallback, error shape |
| `app/src/tools/define-tool.ts`, `tool-schemas.ts`, `tool-errors.ts`, `index.ts` | foundation | tool contract, span wrapper, registry |
| `app/src/types/*`, `shared/types.ts` | foundation | every contract; extend, never rename |
| `app/src/es/*` | foundation / data | client with timeouts, index mappings, ensureIndices |
| `app/src/observability/*` | observability | tracer, metrics, pino logger with trace ids |
| `app/src/security/tokens.ts` | check-in | HMAC QR tokens |
| `app/src/xp/*` | check-in / XP | award (stores traceId), levels, banners |
| `app/src/world/walk.ts` | world | walk-time estimates |
| `app/src/match/talks.ts`, `match/people.ts` | match | `recommendTalksFor`, `recommendPeopleFor` (RRF hybrid, geo) |
| `app/src/meet/arrivals.ts` | hallway | `completeMeetByHandshake(attendeeId, partnerId)` marks an accepted meet `met`; `recordArrival` is no longer called (campfire scans are plain visits) |
| `app/src/handshake/*` | hallway | phone-to-phone handshake: store (`handshakes` index), question choice, answer matching (`answer-match.helper.ts`, with a `node:test` file) |
| `app/src/booth/booth-notes.ts` | check-in | booth notes (`booth_notes` index, `noteText` semantic_text written in the background), outpost XP rules |
| `app/src/messages/messages.ts` | hallway | messages between players in a mutually accepted meet (`messages` index) |
| `app/src/recap/*` | recap | recap data, rule-based next steps, pure email renderer (`recap-email.ts`) |
| `app/src/ai/handshake.ts` | ai | optional phrasing of the handshake question (1.5 s budget, template fallback) |
| `app/src/quests/complete.ts`, `quests/boss.ts` | quests | `completeQuestsFor(event)`, `recordBossAnswers(attendeeId, talkId, correct)` |
| `app/src/ai/client.ts`, `ai/hallway.ts`, `ai/quiz.ts` | ai | inference / Agent Builder; `chatPrompt`, `generateQuiz`; models stay out of `app/src/tools/` |
| `scripts/index-all.ts` | data | ensure indices, bulk-index `resources/*.json` (`npm run index-all` in `app/`) |
| `Dockerfile`, `deploy/` | deploy | multi-stage build, runtime node:22-alpine, USER 1000 |

Cross-lane helpers start as stubs that throw `NotImplementedError` (HTTP 501, code `not_implemented`). Callers catch it and degrade.

## Tools

| Tool | Input | Output | XP |
|------|-------|--------|----|
| sign_up | ISignUpInput | ISignUpResult | yes |
| get_profile | IAttendeeInput | IProfile | |
| update_settings | IUpdateSettingsInput | IProfile | |
| check_in | ICheckInInput | ICheckInResult | yes |
| screen_token | IScreenTokenInput | IScreenToken | |
| whats_around_me | IAttendeeInput | IWhatsAroundMe | |
| whats_next | IAttendeeInput | IWhatsNext | |
| search | ISearchInput | ISearchResponse | |
| recommend_talks | IRecommendTalksInput | ITalkMatch[] | |
| recommend_people | IRecommendPeopleInput | IPersonMatch[] | |
| quest_board | IAttendeeInput | IQuestBoard | |
| respond_quest | IRespondQuestInput | IRespondQuestResult | |
| make_quest | IMakeQuestInput | IQuest | |
| quiz_for_talk | IQuizForTalkInput | IQuiz | |
| submit_quiz | ISubmitQuizInput | IQuizResult | yes |
| boss_state | IBossStateInput | IBossState | |
| propose_meet | IProposeMeetInput | IMeet | |
| respond_meet | IRespondMeetInput | IRespondMeetResult | yes |
| list_meets | IAttendeeInput | IMeet[] | |
| leaderboard | ILeaderboardInput | ILeaderboard | |
| inventory | IAttendeeInput | IInventory | |
| world | IWorldInput | IWorld | |
| organizer_stats | IOrganizerStatsInput | IOrganizerStats | |
| handshake_code | IAttendeeInput | IHandshakeCode | |
| start_handshake | IStartHandshakeInput | IHandshake | |
| handshake_state | IHandshakeStateInput | IHandshakeStateResult | |
| answer_handshake | IAnswerHandshakeInput | IHandshake | yes |
| save_booth_note | ISaveBoothNoteInput | ISaveBoothNoteResult | yes |
| list_booth_notes | IAttendeeInput | IBoothNote[] | |
| send_message | ISendMessageInput | IMessage | |
| list_messages | IListMessagesInput | IMessage[] | |
| recap | IAttendeeInput | IRecap | |

Contracts live in `IToolContracts` (`app/src/types/kubequest.interfaces.ts`). The XP column marks tools whose route must set `kubequest.xp.awarded`; the owning lane sets `xpAwarded` in its `defineTool` call.
