# KubeQuest API: the UI contract

Every screen talks to one Express API. All game actions are **tools**, called the same way by the UI, the assistant, the MCP server and the CronJob:

```
POST /api/tools/<tool_name>
Content-Type: application/json
<input JSON>
```

The response body is the tool's output as JSON (HTTP 200) or an error envelope (4xx/5xx). Every request below was run with curl against the local server on 2026-11-09 (`PORT=8090`, live Elastic Cloud data). The full, unabridged responses are in `resources/fixtures/<tool>.json` (`request`, `status`, `response`, plus `variants` for other cases). Signed tokens are replaced with `<signed-token>`; player handles are the seeded pseudonyms plus one test player, `verify93279`.

JSON in this doc is trimmed: long strings end in `…` and `"…N more"` stands for array items that were cut. Use the fixtures for mocks.

## Other routes

| Route | Use |
|---|---|
| `GET /api/config` | Boot data: `{ appVersion, publicBaseUrl, conferenceTimeZone, demoSimulateScans, githubVerifyEnabled, traceUrlTemplate?, rum? }`. `githubVerifyEnabled` shows or hides the "Verify with GitHub" button. Call once at start. `demoSimulateScans` is `true` only when the server runs with `DEMO_SIMULATE_SCANS=true`; the map shows its "Demo: simulate scan" button only then. |
| `GET /api/tools` | Every tool with `name`, `description`, `awardsXp` and its JSON Schema `inputSchema`. |
| `GET /api/screen-token/:locationId?key=<displayKey>` | The only way to run `screen_token`. Needs the location's display key as `?key=` or the `x-screen-key` header; without it, `403 bad_screen_key`. Used by the demo screen. |
| `GET /r/:locationId?t=<token>` | Printed and on-screen QR codes open this. With the Angular build it serves the SPA (the scan-result route); without it, it returns the JSON in `fixtures/scan_route.json`. |
| `GET /h/<token>` | A handshake QR (from `handshake_code`) opens this. With the Angular build it serves the SPA; read the token from the path segment and call `start_handshake`. Without the build it returns a JSON hint. |
| `GET /api/booth-photos/:photoId.jpg` | The bytes of one booth photo (the `url` in `list_booth_photos`), with its real `Content-Type` and `Cache-Control: public, max-age=3600`. A hidden or deleted photo is `404 unknown_photo`. |
| `GET /api/recap/:attendeeId/email.html` | The player's recap email (`recap.emailHtml`) as `text/html`. A mock of it is in `docs/mock/recap-email.html`; no email is sent. |
| `GET /api/recap/:attendeeId.pdf` | The end-of-event recap as a PDF download (`application/pdf`, `Content-Disposition: attachment`). Same auth model as the email route: it takes the private `attendeeId`, so only link it from the player's own recap screen. Pages: a block-art cover (pixel face, handle, level, XP bar, totals, banners), People you met (one card per connection with where you met, the chat prompt, your private notes and clickable link annotations), Talks you attended (your talk notes, takeaways and quiz score), Booths you visited (your booth notes), the itinerary when the attendee has one, and next steps. Headings use the OFL Silkscreen font from `resources/fonts`. Unknown id: `404 unknown_attendee` as JSON. |
| `POST /api/profile-import` | Multipart form: `attendeeId` plus a `file` field holding a resume or LinkedIn PDF (max 5 MB). Reads the text in memory and returns the same JSON as `import_profile`; the file is never written to disk or Elastic. `413 file_too_large`, `415 not_a_pdf`, `422 unreadable_pdf`, `429 rate_limited`. |
| `GET /auth/github/start?attendeeId=p_…` | Only when `GET /api/config` has `githubVerifyEnabled: true` (env `GITHUB_OAUTH_CLIENT_ID` and `GITHUB_OAUTH_CLIENT_SECRET` set). Navigate the browser here (not XHR). Sets a 10-minute HttpOnly `kq_gh_state` nonce cookie and redirects to GitHub with a signed state (attendeeId, expiry, nonce, HMAC). Off: redirects to `/profile?github=off`. |
| `GET /auth/github/callback?code=&state=` | GitHub sends the player back here. The state signature, expiry and cookie nonce must all match (CSRF), the code is exchanged server-side, and the GitHub login from `GET api.github.com/user` becomes `links.github` with `githubVerified: true`. Redirects to `/profile?github=verified`, `failed` or `cancelled`. Saving a different GitHub link with `update_links` clears `githubVerified`. |
| `GET /healthz`, `GET /readyz` | Liveness, and readiness that pings Elasticsearch: `{"status":"ok","version":"dev","elasticsearch":"reachable"}`. |

`/api/config` from this server:

```json
{"appVersion":"dev","publicBaseUrl":"https://kube-quest.cnh.radarhq.io","conferenceTimeZone":"America/Denver","demoSimulateScans":false}
```

## Identity

There are no auth headers. The demo sign-in is `sign_in` with a name and an email (no password; the live-demo account is **John Doe**, `johndoe@gmail.com`, created by `npm run seed:demo`). It returns the same `attendee.id` and `personalLink` as `sign_up`, and `needsOnboarding` tells the UI whether to run the onboarding questions, which it sends to `sign_up` with that `attendeeId`. `sign_up` without an `attendeeId` still creates a player directly. `sign_up` returns `profile.attendee.id` (for example `p_Ljp4ZfHC-VPDFwqx`) and `personalLink` (`https://kube-quest.cnh.radarhq.io/me/<id>`). Store the id in `localStorage`; if it is missing, send the player to signup or ask them to open their personal link. Every player tool takes it as `attendeeId`.

The `attendeeId` is the player's only credential: anyone who has it can act as that player. Treat it like a password, and never show it to anyone but its owner. Every other player in every response (leaderboard rows, `recommend_people`, `search` player results, `whats_around_me.matchesHere`, a meet's `partner`, a quest's `partnerId`, `get_profile` with `targetId`) carries only a **public id** (`pl_` plus 16 hex characters, for example `pl_592a78e076ad8c1f`), the handle and the face. Tools that point at another player (`get_profile` `targetId`, `propose_meet` `partnerId`) take that public id and resolve it on the server. The player's own public id is `profile.publicId` (from `sign_up`, `get_profile`, `update_settings`); the leaderboard `me` row also uses it, so match rows with `isMe`, not by comparing ids. New attendee ids are random (`p_` plus 16 random base64url characters), never derived from the handle. An unknown or stale public id returns `404 unknown_player`.

### Staff and organizer access keys

Booth staff and organizers have no accounts either. Their views are opened with an **access key** in the link: `?k=<key>`. A key is `k.` plus a base64url HMAC-SHA256 of `k:<scope>` with the server's `QR_SECRET`, where the scope is `admin` or `exhibitor:<outpostId>`. A booth's staff link is `https://kube-quest.cnh.radarhq.io/exhibitor/<outpostId>?k=<key>` and the organizer link is `https://kube-quest.cnh.radarhq.io/admin?k=<key>`. `exhibitor_dashboard` accepts that booth's key or the admin key; `admin_overview` only the admin key. Any other key is `403 bad_key`. The UI reads `k` from the URL, keeps it per booth in `localStorage` (`AccessKeyService`) and sends it as `key`. Keys are never written to span attributes or logs, and fixtures show them as `<staff-key>` and `<admin-key>`. `npm run access-links` (with `QR_SECRET` set to the cluster's value) prints the admin link and every booth's staff link. Treat a key like a password: rotating `QR_SECRET` revokes every key and every printed QR at once.

## Errors

Every failure has the same envelope:

```json
{"error":{"code":"invalid_input","message":"That request is missing something: locationId: Invalid input: expected string, received undefined; token: Invalid input: expected string, received undefined"}}
```

`message` is written for players, so show it as is. Branch on `code`, not on the message.

| Status | Codes seen | UI behaviour |
|---|---|---|
| 400 | `invalid_input`, `invalid_json`, `self_handshake` | A UI bug, or (`self_handshake`) the player scanned their own code. Show the message. |
| 403 | `bad_signature`, `expired_token`, `missing_token` (check_in, start_handshake), `no_screen`, `bad_screen_key` (screen token), `screen_only` (`POST /api/tools/screen_token`), `bad_key` (exhibitor_dashboard, admin_overview) | On a scan, show "scan the code on the door" with the message. For `bad_key`, forget the stored key for that view and show the message with a field to paste a staff link. |
| 404 | `disabled` (demo_scan_token with `DEMO_SIMULATE_SCANS` off), `unknown_attendee`, `unknown_player`, `attendee_not_found`, `unknown_location`, `unknown_talk`, `talk_not_found`, `boss_not_found`, `unknown_meet`, `unknown_quest`, `unknown_outpost`, `unknown_handshake`, `unknown_connection`, `unknown_tool`, `not_found` | For `unknown_attendee`, clear the stored id and go to signup (not for `unknown_player`, which is about the other player). Otherwise show the message. |
| 409 | `handle_taken`, `meeting_off`, `no_match`, `meet_closed`, `meet_locked`, `quest_not_open`, `quest_not_active`, `quest_done`, `quest_expired`, `too_many_active`, `code_used`, `already_shook_hands`, `already_answered`, `handshake_closed`, `meet_not_accepted`, `conflict` | An expected game state. Show the message and refetch the screen's data. |
| 429 | `slow_down` (send_message) | Show the message; let the player try again in a few minutes. |
| 500 | `internal_error` | Show a toast and retry once. |
| 501 | `not_implemented` | The feature isn't built yet. Hide the control. |
| 502/503 | `datastore_write_failed`, `datastore_unavailable`, `qr_secret_missing` | Elastic is down or misconfigured. Show "try again in a moment" and back off. |

A check-in that is refused for a game reason is **not** an error: it returns 200 with `status: "rejected"` and a `rejectedReason` (`outside_session`, `daily_cap`, `wrong_building`). `status: "repeat"` means the player already scanned this place this hour.

## Latency (local server, live Elastic)

Show a spinner on anything that writes. Measured times: `sign_up` 4.1 s, `check_in` 0.9 to 2.8 s (5.7 s when it completes a meet), `submit_quiz` 2.8 s, `respond_quest` 1.5 to 2.1 s, `update_settings` 1.0 s. Reads take 0.1 to 0.7 s.

## Polling

There are no websockets. Poll, and stop when the tab is hidden (`document.visibilityState`).

| What | Tool | Interval | Stop when |
|---|---|---|---|
| Boss bar (phone and screen) | `boss_state` | 3 s | `status` is `defeated` or `escaped` |
| Meet screen, waiting for the partner | `list_meets` | 10 s | no meet is `proposed` or `accepted` |
| Handshake: own QR | `handshake_code` | every 50 s (codes live 60) | the code was scanned (`handshake_state` returns a handshake) |
| Handshake: own QR, waiting to be scanned | `handshake_state` without `handshakeId` | 2 s | it returns a `handshake`; then poll with its id |
| Handshake in progress | `handshake_state` with `handshakeId` | 2 s | `status` is not `waiting` |
| Meet chat | `list_messages` with `since` (the last message's `at`) | 5 s | the chat is closed |
| Itinerary Now card | `whats_around_me` | 30 s, and right after every `check_in` | |
| Quests tab | `quest_board` | on tab focus and after every `check_in` (offers refresh after a scan) | |
| Demo screen leaderboard | `leaderboard` | 15 s | |
| Notification bell (top bar) | `list_notifications` | 30 s | the tab is hidden or nobody is signed in |
| Demo screen QR | `GET /api/screen-token/:locationId` | every 8 minutes (tokens live 10) | |
| Booth page live counts | `get_exhibitor` | 30 s | |
| Exhibitor dashboard | `exhibitor_dashboard` | 15 s | a `bad_key` |
| Organizer view | `admin_overview` | 30 s | a `bad_key` |

On a 5xx, double the interval up to 60 s, then reset after a success.

## Screens and the tools they use

| Screen | Tools |
|---|---|
| Signup (from a scan or the home page) | `GET /api/config`, `sign_up` (pass `scanLocationId` and `scanToken` when the player came from `/r/:locationId?t=`) |
| Scan result (`/r/:locationId?t=`) | `check_in` if an id is stored, otherwise signup with the scan attached. Then `quiz_for_talk` when `quizAvailable` is true |
| Itinerary: Now | `whats_around_me`, `boss_state` (boss rooms), `quiz_for_talk`, `submit_quiz` |
| Itinerary: Next | `whats_next` |
| Here: Ask the guide | `ask_guide` (call again after a few seconds while `pending` is `true`) |
| Itinerary tab `/itinerary` | `list_schedule` (What's on), `get_itinerary` (My plan), `add_to_itinerary`, `remove_from_itinerary`, `make_quest` |
| Search | `search`, `world` (browse by building, level and room), `make_quest` ("Make this a quest") |
| Quests | `quest_board`, `respond_quest`, `recommend_people`, `recommend_talks`, `propose_meet` |
| Meet screen | `list_meets` (one item), `respond_meet`, `send_message`, `list_messages` (once the meet is `accepted` or `met`) |
| Handshake | `handshake_code` (show `scanUrl` as a QR), `handshake_state`, `start_handshake` (after scanning `/h/<token>`), `answer_handshake` |
| Booth note (after an outpost scan, `noteRequired: true`) | `save_booth_note`, `list_booth_notes` |
| Photo quest card, booth details on the map | `upload_booth_photo`, `list_booth_photos`, `report_booth_photo`, `delete_booth_photo` |
| Recap | `recap` (or `GET /api/recap/:attendeeId/email.html`), "Download my recap PDF" (`GET /api/recap/:attendeeId.pdf`) |
| People met `/connections`, `/connections/:connectionId` | `list_connections`, `save_connection_note` |
| My links `/links` | `get_profile` (own `attendee.links`), `update_links` |
| Talk notes `/notes/talks`, and the embeddable `app-talk-notes-panel [talkId]` | `list_talk_notes`, `save_talk_note` |
| Profile | `get_profile`, `inventory`, `leaderboard` (3 boards), `update_settings` |
| Another player's card | `get_profile` with `targetId` |
| Notification bell (every screen with the top bar) | `list_notifications`, `mark_notifications_read` |
| Boss bar | `boss_state` |
| Demo screen `/screen/:locationId` | `GET /api/screen-token/:locationId` (QR of `scanUrl`), `boss_state` with `locationId`, `leaderboard` |
| Booth directory `/exhibitors` (attendee, Booths tab) | `list_exhibitors` (search box sends `query`; chips send `type`, `tier`, `zone`, `topic`; pass `attendeeId` for "Visited" and topic-first order) |
| Booth page `/exhibitors/:outpostId` | `get_exhibitor` (pass `attendeeId`), `make_quest` with `targetKind: "outpost"` ("Make this a quest"), `get_profile` with `targetId` for a player here |
| Exhibitor home `/exhibitor` | Saved booths from `localStorage`, a field to paste a staff link; no tool until a booth is opened |
| Exhibitor dashboard `/exhibitor/:outpostId?k=` | `exhibitor_dashboard` (draw `scanUrl` as the booth's QR) |
| Organizer `/admin?k=` (`/organizer` redirects) | `admin_overview` (it embeds `organizer_stats`) |

### Demo screen `/screen/:locationId`

The screen is a full-screen page in the SPA, for example `/screen/cloud-native-hackathon`. It:

1. Calls `GET /api/screen-token/cloud-native-hackathon?key=<displayKey>` (passing on the `key` from its own URL) and draws `scanUrl` as a large QR code. It refetches every 8 minutes; the token expires after 10 (`expiresAt`), so a photo of an old code stops working.
2. Polls `boss_state` with `{"locationId":"cloud-native-hackathon"}` every 3 s and draws the health bar from `health` and `maxHealth`.
3. Polls `leaderboard` every 15 s.

Only locations with a screen can mint tokens: `cloud-native-hackathon`, `salt-palace-level-1-hall-de`, `salt-palace-level-1-cloud-native-theater` and `salt-palace-level-1-demo-theater`. Any other location gets `403 no_screen`.

## Tools

Enum values used below:

- Location `kind`: `room`, `outpost`, `theater`, `campfire`, `boss-room`
- Quest `status`: `offered`, `accepted`, `not_now`, `declined`, `dropped`, `completed`, `expired`
- Meet `status`: `proposed`, `accepted`, `met`, `declined`, `cancelled`, `expired`
- Check-in `status`: `awarded`, `repeat`, `rejected`
- Boss `status`: `waiting`, `fighting`, `defeated`, `escaped`
- Itinerary item `kind`: `talk`, `meet`, `quest`, `gap`
- Search `kinds`: `session`, `player`, `outpost`, `room`, `campfire`
- Track: `ai`, `platform`, `operations`, `data`, `security`, `connectivity`, `inclusion`, `other`
- Exhibitor `type`: `sponsor`, `project`
- Exhibitor `tier`, in display order: `Diamond`, `Platinum`, `Gold`, `Silver`, `Start-Up`, `End User`, `Media Partner`, `Exhibitor`, `Project`
- Handshake `status`: `waiting`, `matched`, `mismatched`, `expired`; `role`: `asker`, `answerer`; `questionSource`: `shared_topic`, `booth_note`, `talk`, `working_on`, `fallback`

### sign_in

Demo sign-in, no password. Required: `name` (1 to 80 chars) and `email` (trimmed, lowercased, validated). The email is the account key: the same email always returns the same player. A new email creates a minimal player (random `p_` id, handle from the name, lowercase letters and digits, with a short number added if it is taken; `meetingOn: false`, `xp: 0`).

```json
{"name":"John Doe","email":"johndoe@gmail.com"}
```

```json
{"attendee":{"attendee":{"id":"p_…","handle":"johndoe","faceSeed":"066031b9bc419b8f","displayName":"John Doe","email":"johndoe@gmail.com","workingOn":"","profile":{"topics":[],"firstTimer":false,"welcomer":false},"settings":{"meetingOn":false,"…":"…"},"visible":true,"xp":0,"level":1,"banners":[],"blockedIds":[]},"level":{"level":1,"name":"Pod","…":"…"},"inventory":{"…":"same shape as the inventory tool"},"personalLink":"https://kube-quest.cnh.radarhq.io/me/p_…","publicId":"pl_01c88990a33676aa"},
 "personalLink":"https://kube-quest.cnh.radarhq.io/me/p_…",
 "isNew":true,"needsOnboarding":true}
```

`attendee` is the own profile (the same object as `get_profile` without `targetId`). `isNew` is `true` only when this call created the player. `needsOnboarding` is `true` for a new player and for a returning one whose profile has neither `workingOn` nor `topics`; send them to onboarding, then call `sign_up` with `attendeeId`. `email` and `displayName` appear only in the player's own profile: never in `get_profile` with `targetId`, the leaderboard, `search`, `recommend_people`, `whats_around_me`, meets, messages, handshakes or the recap.

Errors: `400 invalid_input` for a missing name or a malformed email (`"email: Invalid email address"`); `409 handle_taken` only if no free handle could be picked for the name; `502/503` when Elastic is down. Fixture: `resources/fixtures/sign_in.json` (`variants.returning`, `variants.invalid_email`).

### sign_up (awards XP)

Required: `handle` (3 to 20 chars, `^[a-z0-9_.-]+$`, unless `attendeeId` is sent), `workingOn`, `firstKubeCon`, `meetingOn`. Optional: `attendeeId`, `happyToWelcome`, `topics` (up to 5), `spotMe`, `githubLogin`, `realName`, `accessibleMode`, `noWalking`, `scanLocationId`, `scanToken`, and from a confirmed `import_profile`: `headline` (≤120), `skills` (≤20), `offers` (≤8), `asks` (≤8), `summary` (≤1200), `seniority` (≤30). Emails, phones and links are stripped from those again on save. Also optional: `intent` (see below).

`intent` is the "Why are you here today?" step: `{"goals":["exploring","hiring"],"exploringField":"AI inference","socialLevel":"lots"}`. `goals` (one or more) are `exploring` (Exploring a new field), `deep_dive` (Going deep on a technology I use), `hiring`, `job_seeking` (Looking for a new role), `booth` (Representing my company at a booth), `community` (Meeting the community / giving back), `talks` (Mostly here for the talks) and `sent` (My company sent me). `exploringField` is kept only with `exploring` and is cleaned like a topic (a preset label, or lowercased free text). `socialLevel` is `light` (Keep it light), `some` (Some intros) or `lots` (Introduce me to everyone); when omitted it defaults from the goals: any of `hiring`, `exploring`, `community` means `lots`, only `sent` and/or `talks` means `light`, anything else `some`. It is stored as `attendee.intent` (`exploringField` is `null` when unset), returned only in the player's own profile, and change it later with `update_settings`.

What `intent` changes:
- Quest mix (`quest_board`): `light` gives at most 1 meet (`chat`) quest a day, never in the first 2 offers, and none once the player has met someone today; `some` keeps the default mix; `lots` (and booth reps at `some`) lets up to 2 of 3 offers be meets. `talks` favours `attend` and `quiz` quests; `booth` caps `outpost` quests at 1 and favours meets; `hiring` and `job_seeking` favour meets.
- Matching (`recommend_people`, chat quests): with `exploringField`, experienced players (`welcomer`, or not first-timers) whose topics, skills, `workingOn` or headline match the field rank first, with a reason like `@podwrangler works on AI inference every day; you're exploring it`. `hiring` boosts players whose goals include `job_seeking` (and the reverse), weighted by shared skills, topics and `seniority`, only when the other player chose that goal. A player with `socialLevel: light` is matched into at most one meet a day: once anyone proposed a meet with them today, they leave everyone else's recommendations.

`topics` may be presets or the player's own (for example `"Kueue"`). Each is trimmed and whitespace-collapsed; a preset matched case-insensitively is stored with its preset label, anything else is stripped to letters, digits, spaces and `- + . # /`, must be 2 to 30 characters, is dropped if it looks like an email or URL, and is stored lowercased (`"kueue"`). Duplicates are dropped; at most 5.

`summary`, `skills`, `offers` and `asks` go into `profileText` (the semantic embedding used by `recommend_people`) and are returned only in the player's own profile. `get_profile` with `targetId`, `recommend_people`, `search`, meets, handshakes and the leaderboard never include them.

```json
{"handle":"verify93279","workingOn":"Running GPU inference on Kubernetes with autoscaling","firstKubeCon":true,"happyToWelcome":false,"topics":["ai","gpu","autoscaling"],"meetingOn":true,"spotMe":"Green hoodie","scanLocationId":"salt-palace-level-1-150-defg","scanToken":"<signed-token>"}
```

```json
{"profile":{"attendee":{"id":"p_Ljp4ZfHC-VPDFwqx","handle":"verify93279","faceSeed":"cbd1b4ac2fe4ff69","spotMe":"Green hoodie","workingOn":"Running GPU inference on Kubernetes with autoscaling","profile":{"topics":["ai","gpu","autoscaling"],"firstTimer":true,"welcomer":false},"settings":{"accessibleMode":false,"noWalking":false,"locationOn":true,"language":"en","hideFromLeaderboard":false,"meetingOn":true},"visible":true,"xp":0,"level":1,"banners":[],"lastLocationId":"salt-palace-level-1-150-defg"},"level":{"level":1,"name":"Pod","xp":0,"levelMinXp":0,"nextLevelXp":50,"nextLevelName":"Deployment","progress":0},"inventory":{"…":"same shape as the inventory tool"},"personalLink":"https://kube-quest.cnh.radarhq.io/me/p_Ljp4ZfHC-VPDFwqx","publicId":"pl_4451cf61b8914498"},
 "personalLink":"https://kube-quest.cnh.radarhq.io/me/p_Ljp4ZfHC-VPDFwqx",
 "starterMaterial":"wood","xpAwarded":0,
 "firstQuest":{"id":"q_09012f7849878be86dedf78a","type":"chat","status":"offered","title":"Meet @quietgopher","reason":"Working on Platform engineer, first KubeCon…","nextStep":"Accept, then meet at the campfire…","reward":{"xp":75,"gems":1,"label":"75 XP + 1 gem each"},"walkMinutes":0,"partnerId":"pl_5f917ee1a2a89af1","expiresAt":"2026-11-09T20:39:56.010Z"},
 "checkIn":{"status":"rejected","message":"Nothing is running in 150 DEFG right now. Scan again while a session is on to earn XP.","xpAwarded":0,"rejectedReason":"outside_session","location":{"id":"salt-palace-level-1-150-defg","name":"150 DEFG","kind":"room"},"quizAvailable":false,"completedQuests":[],"newBanners":[]}}
```

`checkIn` is present only when `scanLocationId` was sent, and has the `check_in` shape. A taken handle returns `409 handle_taken`.

With `attendeeId` (a player from `sign_in` finishing onboarding), `sign_up` updates that player's profile fields instead of creating one; `handle` is optional and changes the handle only when sent and free. The starter block is awarded once, on the first onboarding. An unknown `attendeeId` returns `404 unknown_attendee`. Without `attendeeId` and without `handle`, it returns `400 invalid_input` (`handle: handle is required to create a player`).

### import_profile

`{"attendeeId":"p_…","text":"<pasted resume or LinkedIn text>"}` returns a suggested profile. Nothing is saved: show it for review, let the player edit it, then send the confirmed fields to `sign_up` with `attendeeId`. For a PDF, use `POST /api/profile-import` (see Other routes); it returns the same shape.

```json
{"headline":"Platform Engineer scaling GitOps for 200+ services","role":"Senior Platform Engineer","seniority":"senior","skills":["Kubernetes","GitOps","Argo CD","Backstage","Helm"],"topics":["Platform engineering","GitOps","Observability"],"workingOn":"Building internal developer platforms on Kubernetes with Argo CD and Backstage","offers":["GitOps at scale","Backstage setup"],"asks":["Kueue batch scheduling","GPU inference with vLLM"],"summary":"Senior platform engineer leading internal developer platforms…","provider":"agent_builder"}
```

The text is capped at 12,000 characters; emails, phone numbers and URLs are removed before the model sees it, and the raw text is never returned or stored. `topics` come only from the preset list. The model has a 10 s budget (Agent Builder usually takes 10 to 15 s); past it you get `provider: "fallback"` (keyword skills and topics, the first two sentences as `summary`) in about 10.3 s. The model keeps running and its answer is cached for 30 minutes, so calling again with the same text (or re-uploading the same PDF) about 5 s later returns `provider: "agent_builder"` in under 0.1 s; the onboarding screen does that once automatically. Limit: 5 calls per player per hour (cached repeats are free), else `429 rate_limited`. Under 40 readable characters returns `400 not_enough_text`. Fixture: `resources/fixtures/import_profile.json`.

### get_profile

`{"attendeeId":"p_…"}` returns the player's own profile: the same `profile` object as in `sign_up` (`attendee`, `level`, `inventory`, `personalLink`, `publicId`).

With `targetId` (the other player's public id, `{"attendeeId":"p_…","targetId":"pl_592a78e076ad8c1f"}`), it returns another player's public card; `attendee.id` and `publicId` are both the public id. `workingOn`, `profile.topics`, `spotMe`, `realName` and the photo are blanked unless the two have a confirmed meet, and `personalLink` is `""`:

```json
{"attendee":{"id":"pl_592a78e076ad8c1f","handle":"podwrangler","faceSeed":"podwrangler","workingOn":"","profileText":"","profile":{"topics":[],"firstTimer":false,"welcomer":false},"xp":110,"level":2,"banners":["welcomer"]},"level":{"level":2,"name":"Deployment","xp":110,"levelMinXp":50,"nextLevelXp":200,"nextLevelName":"Node","progress":0.4},"inventory":{"…":"…"},"personalLink":"","publicId":"pl_592a78e076ad8c1f"}
```

After a confirmed meet (`variants.get_profile_partner`), `workingOn` and `topics` are filled in.

### update_settings

```json
{"attendeeId":"p_Ljp4ZfHC-VPDFwqx","settings":{"accessibleMode":false,"noWalking":false},"topics":["ai","gpu","autoscaling","platform"]}
```

`settings` keys: `meetingOn`, `accessibleMode`, `noWalking`, `locationOn`, `language`, `hideFromLeaderboard`. You can also send `topics`, `workingOn`, `spotMe`, `realName`, `visible` and `intent` (the same shape as in `sign_up`; it replaces the stored intent, for example `{"attendeeId":"p_…","intent":{"goals":["exploring"],"exploringField":"AI inference","socialLevel":"some"}}`). It returns the full own profile, like `get_profile`. Turning `meetingOn` off withdraws every open meet.

### check_in (awards XP)

```json
{"attendeeId":"p_Ljp4ZfHC-VPDFwqx","locationId":"outpost-elastic","token":"<signed-token>","geo":{"lat":40.766,"lon":-111.894}}
```

`geo` is optional; send it only when the player turned location on.

**An outpost (booth) scan no longer awards XP.** It saves the booth to the player's notes and returns the note with `noteRequired: true`. Open the booth-note form and call `save_booth_note`; that is where the 10 XP comes from. The first scan returns `status: "awarded"` (the scan was accepted), later scans `status: "repeat"`; both have `xpAwarded: 0`. `noteRequired` turns `false` once the note has earned its XP:

```json
{"status":"awarded","message":"Saved Elastic to your notes. Ask them about Hybrid search with semantic_text and Agent Builder. Add what you liked to earn 10 XP. We'll send you a summary of every booth and person after the conference.","xpAwarded":0,"location":{"id":"outpost-elastic","name":"Elastic","kind":"outpost","boothNumber":"196","sponsorTier":"Gold","askAbout":"Hybrid search with semantic_text and Agent Builder"},"quizAvailable":false,"completedQuests":[],"newBanners":[],
 "boothNote":{"id":"bn-5e2d8c4a1f7b49d3a6c0e8b1","locationId":"outpost-elastic","boothName":"Elastic","boothNumber":"196","sponsorTier":"Gold","liked":"","followUp":false,"xpAwarded":0,"createdAt":"2026-11-09T21:21:05.118Z","updatedAt":"2026-11-09T21:21:05.118Z"},"noteRequired":true}
```

**A campfire scan no longer completes a meet.** It is a plain visit (0 XP, `"You're at Network Nook. When you find your match, open Handshake and scan each other's phone."`). Meets complete with the phone-to-phone handshake (`answer_handshake`).

The other cases are in `fixtures/check_in.json` under `variants`:

| Variant | Result |
|---|---|
| `check_in_outpost` | 200, `status: "awarded"`, `xpAwarded: 0`, `boothNote`, `noteRequired: true` |
| `check_in_outpost_repeat` | 200, `status: "repeat"`, the same note |
| `check_in` (a room with nothing running) | 200, `status: "rejected"`, `rejectedReason: "outside_session"` |
| `check_in_bad_token`, `check_in_wrong_location` (the token is for a different place) | 403 `bad_signature` |
| `check_in_campfire` | 200, `status: "awarded"`, `xpAwarded: 0`, points the player to Handshake |

In a session room during a session, `talkNow` is set and `quizAvailable` is `true`; open the quiz from the scan result. Optional fields: `material` and `gemsAwarded` (blocks and gems earned), `talkNow`, and `levelUp` (a level object, set only when the player levelled up). Show `levelUp` and `newBanners` when they are present. `event.traceId` is the Dash0 trace behind the XP.

### screen_token

Not callable through `POST /api/tools/screen_token` (that returns `403 screen_only`) and not listed by `GET /api/tools`. Room screens call `GET /api/screen-token/:locationId` with the display key, as `?key=` or the `x-screen-key` header. The key is HMAC-SHA256(`QR_SECRET`, `"screen:" + locationId`) in base64url, compared in constant time; `npx tsx scripts/print-qr-links.ts` prints each screen's URL `/screen/<locationId>?key=<displayKey>` for organizers. A missing or wrong key returns `403 bad_screen_key`.

`GET /api/screen-token/cloud-native-hackathon?key=<displayKey>` →

```json
{"locationId":"cloud-native-hackathon","token":"<signed-token>","expiresAt":"2026-11-09T20:30:00.944Z","scanUrl":"https://kube-quest.cnh.radarhq.io/r/cloud-native-hackathon?t=<signed-token>"}
```

A location without a screen returns `403 {"error":{"code":"no_screen","message":"151 has no screen. Scan the printed code on its door."}}`.

### demo_scan_token (demo only)

Lets the venue map simulate a QR scan on stage. It is switched off unless the server runs with `DEMO_SIMULATE_SCANS=true`; otherwise every call returns `404 {"error":{"code":"disabled","message":"Simulated scans are switched off."}}`. It takes no `attendeeId` and awards nothing itself: it returns the path a printed QR code for that location encodes (token from `signLocationToken`, the same token a printed code carries), and the UI navigates there so the normal `/r/:locationId` scan-result screen runs `check_in` for the signed-in player. A player who is not signed in is sent to `/onboarding` with the scan pending, exactly like the camera scanner.

`{"locationId":"outpost-amazon-web-services"}` →

```json
{"locationId":"outpost-amazon-web-services","path":"/r/outpost-amazon-web-services?t=<signed-token>"}
```

An unknown location returns `404 unknown_location`. Because the token is a printed one, anyone who can call this tool can check in anywhere: keep the flag off at a real event (see `docs/ops.md`).

### whats_around_me (Itinerary Now card)

`{"attendeeId":"p_…"}` →

```json
{"location":{"id":"salt-palace-level-1-151","name":"151","kind":"room","building":"Salt Palace","level":"Level 1","room":"151","hasScreen":false,"geo":{"lat":40.76645,"lon":-111.89445}},
 "next":{"id":"kc26-tue-data-platform-panel","title":"Why We Bet the Data Platform on Kubernetes","sessionType":"panel","track":"data","material":"crate","speakers":["Vara Bonthu","…4 more"],"start":"2026-11-10T11:30:00-07:00","end":"2026-11-10T12:00:00-07:00","locationId":"salt-palace-level-1-151","isBoss":false},
 "playersHere":1,"quizAvailable":false,
 "nearestCampfire":{"location":{"id":"campfire-network-nook","name":"Network Nook","kind":"campfire"},"walkMinutes":2,"distanceMeters":25},
 "matchesHere":[{"player":{"id":"pl_592a78e076ad8c1f","handle":"podwrangler","faceSeed":"podwrangler","level":2,"levelName":"Deployment","xp":110,"banners":["welcomer"],"topics":["gpus","…4 more"],"workingOn":"Runs GPU cluster allocation for ML teams…","firstTimer":false},"score":0.0952381,"sharedTopics":[],"reason":"Happy to welcome a first-timer…","sameRoom":true},"…2 more"]}
```

`now` (a talk) is present while a session is running. `location` is missing until the player's first scan.

### whats_next (Itinerary Next)

`{"attendeeId":"p_…"}` → `{"now"?: IItineraryItem, "items": IItineraryItem[]}`. Each item has `{kind, title, start, end?, place?: {locationId, name, kind, building, level}, walkMinutes?, talkId?, questId?, meetId?}`.

It looks 3 hours ahead, and every KubeCon talk is on Nov 10, so today it returns `{"items":[]}`. Run the server with `DEMO_NOW=2026-11-10T09:00:00-07:00` to see a full itinerary.

### list_schedule (Itinerary: What's on)

`{"attendeeId"?:"p_…","day"?:"2026-11-10","from"?:iso,"to"?:iso,"track"?:"platform","building"?:"Hyatt Regency","query"?:"gpu"}` → `{"day","days":["2026-11-09",…,"2026-11-12"],"now","from","to","total","buildings":[…],"slots":[{"start","end","sessions":[IScheduleSession]}]}`.

Every field is optional. `day` defaults to today (conference time zone) when today is a conference day, else Tuesday 2026-11-10. `from`/`to` narrow the window (the Now filter sends now → now + 90 min); a session is included when it overlaps the window. `query` matches title, abstract, room and speakers. Slots are 30 minutes, keyed by the session start rounded down. Each session is `{id, title, speakers, sessionType, track, material, start, end, locationId, building, level, room, isBoss, checkedInCount, inItinerary?}`; `checkedInCount` is distinct players who checked in to that talk, and `inItinerary` is only present when `attendeeId` is given. Fixture: `resources/fixtures/list_schedule.json`.

### get_itinerary (Itinerary: My plan)

`{"attendeeId":"p_…","day"?:"2026-11-10"}` → `{"now","day"?,"plannedCount","maxItems":40,"conflictCount","items":[IPlanItem]}`.

Items are in time order: planned sessions (`kind: "talk"`, with `session`), accepted meets that have a slot (`meet`), accepted quests that have a time and aren't already a planned session (`quest`), and free gaps of 30 min or more between them (`gap`, with `gapMinutes`). Each item: `{id, kind, title, start, end?, place?, walkMinutes?, walkFrom?, gapMinutes?, conflictsWith: [itemId], talkId?, questId?, meetId?, session?, quizAvailable?, isNow?}`. `walkMinutes` is from the previous item on the same day (same walk table as everywhere else). Overlapping items list each other in `conflictsWith`. `quizAvailable` is true once the session has started (open `/quiz/:talkId`). The plan is stored as `itinerary: [{talkId, addedAt}]` on the attendee doc and never appears in other players' views.

### add_to_itinerary / remove_from_itinerary

`{"attendeeId":"p_…","talkId":"kc26-tue-tracing-at-scale"}` → `{"talkId","inItinerary":true|false,"plannedCount","maxItems":40}`. Both are idempotent (atomic painless script on the attendee doc). Adding an unknown talk is `404 talk_not_found`; adding a 41st is `409 itinerary_full`.

### search

```json
{"query":"cheaper GPUs","attendeeId":"p_Ljp4ZfHC-VPDFwqx","limit":5,"filters":{"now":false,"nearMe":false,"track":"platform","building":"Salt Palace","kinds":["session"]},"geo":{"lat":40.766,"lon":-111.894}}
```

Everything except `query` is optional.

```json
{"query":"cheaper GPUs","results":[{"kind":"session","id":"kc26-tue-portable-gpu-config","title":"One Recipe, Five Clouds, One Query: Portable GPU Configuration","subtitle":"Christopher Haar, Yuan Chen · Salt Lake Ballroom C · 18:30","score":0.0952381,"talk":{"…":"full talk"},"startsInMinutes":1330,"distanceMeters":253,"walkMinutes":8},"…4 more"]}
```

A `campfire`, `room` or `outpost` result carries `location`, and a `player` result carries `player` (`variants.search_filtered`). The `score` is an RRF score, so use it for order only.

### recommend_talks

`{"attendeeId":"p_…","limit":3,"withinMinutes":720}` → `[{"talk":ITalk,"location"?:ILocation,"score":n,"reason":"…","startsInMinutes":n,"walkMinutes"?:n}]`. Today it returns `[]`, because no talk starts within 12 hours.

### ask_guide

`{"attendeeId":"p_…"}` → `{"provider":"agent_builder"|"fallback","pending":bool,"interest":"…","picks":[ITalkMatch],"toolCalls":["kubequest.upcoming_talks"],"droppedPicks":n}`. The Elastic Agent Builder agent `kubequest-writer` picks up to 3 talks with its ES|QL tool (Jina semantic match plus Jina rerank). Each pick's `reason` is the agent's one-line why, and every talk id is checked against the index. While the agent is still working (over 10 s), `provider` is `fallback`, `picks` are the reranked `recommend_talks`, and `pending` is `true`. Call again a few seconds later to get the agent's picks (cached for 10 minutes).

### recommend_people

`{"attendeeId":"p_…","limit":3,"hereOnly":false}` →

```json
[{"player":{"id":"pl_592a78e076ad8c1f","handle":"podwrangler","faceSeed":"podwrangler","level":2,"levelName":"Deployment","xp":110,"banners":["welcomer"],"topics":["gpus","gpu-sharing","cluster-allocation","platform-engineering","kueue"],"workingOn":"Runs GPU cluster allocation for ML teams; happy to help first-timers find their feet.","firstTimer":false},"score":0.09307359,"sharedTopics":[],"reason":"Happy to welcome a first-timer…","sameRoom":true},"…2 more"]
```

### quest_board

`{"attendeeId":"p_…"}` →

```json
{"offers":[{"id":"q_09012f7849878be86dedf78a","attendeeId":"p_Ljp4ZfHC-VPDFwqx","type":"chat","status":"offered","source":"board","offeredAt":"2026-11-09T20:19:56.010Z","title":"Meet @quietgopher","reason":"Working on Platform engineer…","nextStep":"Accept, then meet at the campfire…","reward":{"xp":75,"gems":1,"label":"75 XP + 1 gem each"},"partnerId":"pl_5f917ee1a2a89af1","expiresAt":"2026-11-09T20:40:03.877Z"},"…2 more"],
 "active":[],"doneToday":[],"maxOffers":3,"maxActive":3}
```

Quest `type` is `attend`, `outpost`, `chat`, `quiz`, `boss`, `collection` or `photo`. An `attend` or `outpost` quest also has `where`, `when`, `walkMinutes`, `talkId` and `locationId` (see `make_quest`). A `photo` quest ("Photograph the Dash0 booth") names a booth that matches one of the player's topics and has fewer than 3 visible photos; at most one is on the board. It has `where` and `locationId`, and completes when the player, having accepted it, uploads a photo of that booth with `upload_booth_photo`.

### respond_quest

`{"attendeeId":"p_…","questId":"q_…","response":"accept"}`. `response` is `accept`, `not_now`, `not_for_me` (with an optional `reason`: `not_my_topic`, `too_far` or `no_time`) or `drop`. It returns `{"quest": IQuest, "board": IQuestBoard}`, so replace the whole Quests tab with `board`. Accepting a `chat` quest proposes a meet and sets `quest.introId`.

### make_quest

`{"attendeeId":"p_…","targetKind":"session","targetId":"kc26-tue-keynote-openrl"}` (`targetKind` is `session` or `outpost`) →

```json
{"id":"q_6630052209652399c296173c","type":"attend","status":"accepted","source":"player","title":"Attend \"Pods in the Wild: Reinforcement Learning on Kubernetes with OpenRL\"","reason":"You picked this session yourself.","nextStep":"Head to Hall DE; it starts in 1245 min. Scan the room's QR during the session.","reward":{"xp":10,"material":"circuit","label":"10 XP + 1 Circuit block"},"where":{"locationId":"salt-palace-level-1-hall-de","name":"Hall DE","kind":"boss-room","building":"Salt Palace","level":"Level 1"},"when":{"start":"2026-11-10T10:05:00-07:00","end":"2026-11-10T10:13:00-07:00"},"walkMinutes":2,"talkId":"kc26-tue-keynote-openrl","expiresAt":"2026-11-10T10:13:00-07:00"}
```

### quiz_for_talk

`{"talkId":"kc26-tue-keynote-welcome","attendeeId":"p_…"}` →

```json
{"talkId":"kc26-tue-keynote-welcome","talkTitle":"Welcome + Opening Remarks","source":"abstract","isBoss":true,"questions":[{"id":"kc26-tue-keynote-welcome-q1","prompt":"Which track does \"Welcome + Opening Remarks\" belong to?","choices":["ai","…3 more"]},"…4 more"]}
```

A normal talk has 3 questions and a boss has 5. `source` is `transcript` or `abstract`. If the player already submitted, the earlier result is included. The response has no answers. An unknown talk returns `404 talk_not_found`.

### submit_quiz (awards XP)

`{"attendeeId":"p_…","talkId":"kc26-tue-keynote-welcome","answers":[0,0,0,0,0],"startedAt":"2026-11-09T20:19:25.087Z"}`. `answers` holds choice indexes in question order. Send `startedAt` from when the quiz opened; it feeds the `kubequest.quiz.duration` metric.

```json
{"talkId":"kc26-tue-keynote-welcome","correct":1,"total":5,"xpAwarded":5,"alreadySubmitted":false,
 "results":[{"questionId":"kc26-tue-keynote-welcome-q1","chosenIndex":0,"correctIndex":3,"correct":false,"explanation":"It is in the other track."},"…4 more"],
 "boss":{"talkId":"kc26-tue-keynote-welcome","locationId":"salt-palace-level-1-hall-de","status":"waiting","maxHealth":10,"health":9,"damage":1,"playersInRoom":0,"participants":1,"endsAt":"2026-11-10T09:31:00-07:00","deadline":"2026-11-10T16:46:00.000Z","bonusXp":25}}
```

A second submission returns the same result with `alreadySubmitted: true` and `xpAwarded: 0`. `boss` is present only for a boss talk.

### boss_state (boss bar)

`{"locationId":"cloud-native-hackathon"}` or `{"talkId":"cnh-kickoff-2026","attendeeId":"p_…"}` (send at least one of the two ids) →

```json
{"talkId":"cnh-kickoff-2026","title":"Cloud Native Hackathon Kickoff: Make Conferences Easier","locationId":"cloud-native-hackathon","status":"escaped","maxHealth":10,"health":10,"damage":0,"playersInRoom":0,"participants":0,"endsAt":"2026-11-09T11:00:00-07:00","deadline":"2026-11-09T18:15:00.000Z","bonusXp":25,
 "questions":[{"id":"q1","prompt":"What challenge did the kickoff set for teams?","choices":["Make conferences easier to navigate","…3 more"]},"…2 more"]}
```

The bar is `health / maxHealth`. Show a countdown to `deadline` while `status` is `waiting` or `fighting`. `questions` is returned only when `attendeeId` is sent.

### propose_meet

`{"attendeeId":"p_…","partnerId":"pl_592a78e076ad8c1f"}` → a meet viewed by the proposer:

```json
{"id":"meet-4d7c25c123e592d61a6e986e","status":"proposed","role":"proposer","statusLine":"Waiting to hear back. We'll tell you if @podwrangler is in.","partner":{"id":"pl_592a78e076ad8c1f","handle":"podwrangler","faceSeed":"podwrangler","level":2,"levelName":"Deployment","xp":110,"banners":["welcomer"],"topics":["…"],"workingOn":"…","firstTimer":false},"sharedTopics":[],"iAccepted":true,"partnerArrived":false,"expiresAt":"2026-11-09T20:40:13.391Z"}
```

`partnerId` is the other player's public id (from `recommend_people`, `search`, a quest's `partnerId` or a leaderboard row). It fails with `409 meeting_off` if either player has meeting turned off, and `404 unknown_player` if the public id matches no one.

### respond_meet (awards XP)

`{"attendeeId":"att-podwrangler","meetId":"meet-…","response":"accept","blockPartner":false}`. `response` is `accept`, `decline` or `cant_make_it`. It returns `{"meet": IMeetView, "xpAwarded": n}`. Once both players accept, the view gains the meet-screen fields:

```json
{"meet":{"id":"meet-4d7c25c123e592d61a6e986e","status":"accepted","role":"partner","statusLine":"Meet @verify93279 at Network Nook and both scan its code.","partner":{"…":"…"},"partnerDetails":{"spotMe":"Green hoodie"},
  "campfire":{"id":"campfire-network-nook","name":"Network Nook","kind":"campfire","building":"Salt Palace","level":"Level 1","zone":"Solutions Showcase","geo":{"lat":40.76645,"lon":-111.89475}},
  "slot":{"start":"2026-11-09T20:20:14.452Z","end":"2026-11-09T20:50:14.452Z"},
  "icebreaker":"You both work on Kubernetes. Ask what broke last.","chatPrompt":"Ask @podwrangler how they handle gpus on their team.",
  "matchSignal":{"words":"GLASS FOX","pattern":["crate","…63 more"]},
  "sharedTopics":[],"iAccepted":true,"partnerArrived":false,"expiresAt":"2026-11-09T21:20:14.452Z"},"xpAwarded":0}
```

`matchSignal.pattern` holds 64 block materials for an 8x8 grid; both phones show the same grid and words. `partnerDetails` can hold `realName`, `photoUrl` and `spotMe`.

### list_meets (meet screen)

`{"attendeeId":"p_…"}` → an array of the meet views above, in every status. After the two players complete a handshake, the status is `met` and `statusLine` reads `"You met @podwrangler."` (`variants.list_meets_after`).

### leaderboard

`{"board":"overall","period":"conference","attendeeId":"p_…","limit":5}`. `board` is `overall`, `connectors` or `questers`; `period` is `today` or `conference`.

```json
{"board":"overall","period":"conference",
 "rows":[{"rank":1,"player":{"id":"pl_aeea8bd684c45f90","handle":"otelotter","faceSeed":"otelotter","level":3,"levelName":"Node","xp":255,"banners":["welcomer"]},"score":255,"latestTraceId":"90e2360060c52e00dbf8c60099407e00","latestEventAt":"2026-11-09T20:09:18.482Z","isMe":false},"…4 more"],
 "me":{"rank":19,"player":{"id":"pl_4451cf61b8914498","handle":"verify93279","faceSeed":"cbd1b4ac2fe4ff69","level":1,"levelName":"Pod","xp":10,"banners":[]},"score":10,"latestTraceId":"62975e06703755f25f14049bfa8d19ab","isMe":true}}
```

`latestTraceId` links a row to its trace in Dash0. If `/api/config` has a `traceUrlTemplate`, turn it into a link.

### inventory

`{"attendeeId":"p_…"}` →

```json
{"blocks":{"circuit":0,"stone":0,"glass":0,"crate":0,"iron":0,"copper":0,"lantern":0,"wood":1,"gold":0},"totalBlocks":1,"gems":0,
 "banners":[{"id":"observability-nerd","name":"Observability Nerd","description":"Collect 3 glass blocks from Operations + Performance talks","progress":0,"target":3,"earned":false},"…5 more"],
 "xp":10,"level":{"level":1,"name":"Pod","xp":10,"levelMinXp":0,"nextLevelXp":50,"nextLevelName":"Deployment","progress":0.2},"nextLevelXp":50}
```

The banners are `observability-nerd`, `connector`, `welcomer`, `explorer`, `scout` and `speaker`. An earned banner has `earnedAt`.

### world (Search browse, map)

`{"attendeeId":"p_…"}` (optional; it adds `walkMinutes`) →

```json
{"buildings":[{"name":"Salt Palace","levels":[{"name":"Level 1","rooms":[{"location":{"id":"salt-palace-level-1-hall-de","name":"Hall DE","kind":"boss-room","hasScreen":true},"next":{"id":"kc26-tue-keynote-welcome","title":"Welcome + Opening Remarks","start":"2026-11-10T09:00:00-07:00","isBoss":true},"busyness":0,"walkMinutes":2},"…21 more"]},"…1 more"]},"…2 more"],"generatedAt":"2026-11-09T20:20:16.336Z"}
```

`now` appears while a session is running. `busyness` counts check-ins in the last 20 minutes. The full fixture is 48 KB, so cache it for a minute.

### organizer_stats

`{}`, or `{"since":"2026-11-09T00:00:00Z"}` →

```json
{"players":20,"checkInsToday":31,"xpToday":1820,"xpByType":{"check_in":310,"quiz":335,"outpost":220,"handshake":900,"badge":0,"welcome":50,"boss":5},"meets":{"accepted":2,"proposed":4,"met":0},"quests":{"offered":12,"accepted":2,"declined":1},"busiestRooms":[{"location":{"id":"salt-palace-level-1-150-defg","name":"150 DEFG","kind":"room"},"count":1},"…2 more"],"bosses":[],"generatedAt":"2026-11-09T20:20:16.769Z"}
```

### list_exhibitors (booth directory)

`{"query"?, "type"?, "tier"?, "zone"?, "topic"?, "attendeeId"?, "limit"? (1-400, default 60), "offset"? (default 0)}`. Every field is optional; `query` is at most 200 characters, `type` is `sponsor` or `project`, `topic` is a track. `{"attendeeId":"p_…","limit":60}` →

```json
{"exhibitors":[{"id":"outpost-amazon-web-services","name":"Amazon Web Services","exhibitorType":"sponsor","tier":"Diamond","boothNumber":"115","hall":"B","zone":"Astral Peak","topics":["platform","operations","ai"],"categories":["Artificial Intelligence (AI)","Platform Engineering","Observability"],"askAbout":"How EKS Auto Mode handles node upgrades for you","visitorsNow":6,"visitedByMe":true},"…59 more"],"total":320,"facets":{"types":[{"value":"sponsor","count":234},{"value":"project","count":86}],"tiers":[{"value":"Diamond","count":9},"…8 more"],"zones":[{"value":"Cosmic Canyon","count":122},"…5 more"],"topics":[{"value":"platform","count":138},"…7 more"]},"generatedAt":"2026-11-09T21:42:10.512Z"}
```

With `query` the order is relevance: one RRF query fuses BM25 on `name`, `askAbout`, `categories` and `description` with Jina semantic search on `searchText`, then the filters apply. With `query`, matches come from the top 96 relevance hits, so `total` is at most 96. Without it the order is booths matching the player's topics first (when `attendeeId` is given), then tier, then booth number. `total` counts every match, so page with `offset`. Each facet counts the matches with every other filter applied, so a chip shows how many booths it would leave. `visitorsNow` is distinct players who scanned that booth in the last 20 minutes. `visitedByMe` is only present when `attendeeId` is sent. An unknown `attendeeId` is `404 unknown_attendee`. Variants: `filtered` (`{"type":"sponsor","topic":"operations"}`, 39 booths) and `empty` (no match: `exhibitors` is `[]`, `total` 0, facets empty). Latency: about 0.2 s browsing (the booth list is cached for a minute), 0.4 to 0.8 s with `query`.

### get_exhibitor (booth page)

`{"outpostId":"outpost-dash0","attendeeId":"p_…"}` (`attendeeId` optional) →

```json
{"exhibitor":{"id":"outpost-dash0","name":"Dash0","exhibitorType":"sponsor","tier":"Platinum","boothNumber":"134","hall":"B","zone":"Starlight Summit","topics":["operations"],"categories":["Observability","Application Development + Developer Experience"],"askAbout":"OpenTelemetry-native observability and tracing a request end to end","visitorsNow":3,"visitedByMe":true,"building":"Salt Palace","level":"Level 1","description":"Dash0 booth in the Solutions Showcase.","mapPosition":{"x":198.8,"y":517}},"live":{"visitorsNow":3,"visitsToday":41,"uniqueVisitorsToday":37},"talks":[{"id":"kc26-wed-otel-tail-sampling","title":"Tail Sampling Without Tears: …","start":"2026-11-11T11:00:00-07:00","end":"2026-11-11T11:30:00-07:00","where":"Salt Palace · Level 2 · 250 AB","speakers":["…"],"track":"operations"},"…1 more"],"playersHere":[{"id":"pl_…","handle":"otelotter","faceSeed":"otelotter","level":4,"levelName":"Cluster","xp":610,"banners":["welcomer","scout"]},"…2 more"],"nearby":[{"id":"outpost-spectro-cloud","name":"Spectro Cloud","tier":"Platinum","boothNumber":"125","visitorsNow":0,"visitedByMe":false},"…3 more"],"me":{"visited":true,"lastVisitAt":"2026-11-09T20:14:33.208Z","questId":"q_5d0c3a9e71b24f86a1c2e0d4","questStatus":"completed"},"expoMapUrl":"https://events.linuxfoundation.org/wp-content/uploads/2026/11/KCNA26-ExpoHallMap_Digital.pdf","generatedAt":"2026-11-09T21:42:10.512Z"}
```

`talks` (up to 6, by start time) are sessions with a speaker whose company is this exhibitor. `playersHere` (up to 6) are players who scanned this booth in the last 20 minutes and have meeting on and are not hidden from the leaderboard, as public cards; the caller is left out. It is only filled when `attendeeId` is sent and that player has meeting on, and it skips players either side has blocked; otherwise it is `[]`. `nearby` are the 4 closest other booths by `geo_distance`. `me` is only present with `attendeeId`: whether and when the player last scanned this booth, and their booth quest for it if they have one. `mapPosition` is a point on the expo hall PDF (`expoMapUrl`), in the same coordinates as `web/public/venue/schematic.json`; project kiosks also have `schedule`. Errors: `404 unknown_outpost` for a missing id or one that is not a booth, `404 unknown_attendee`. Variants: `project` (the OpenTelemetry kiosk), `not_visited` (an offered booth quest) and `unknown_outpost`. Latency: about 0.3 to 0.6 s.

### exhibitor_dashboard (booth staff)

`{"outpostId":"outpost-dash0","key":"<staff-key>"}` (the booth's key or the admin key) →

```json
{"exhibitor":{"id":"outpost-dash0","name":"Dash0","tier":"Platinum","boothNumber":"134","visitorsNow":3,"…":"same fields as get_exhibitor"},"scanUrl":"https://kube-quest.cnh.radarhq.io/r/outpost-dash0?t=<signed-token>","publicPageUrl":"https://kube-quest.cnh.radarhq.io/exhibitors/outpost-dash0","visits":{"now":3,"today":41,"uniqueToday":37,"conference":58,"uniqueConference":51,"firstTimersToday":12},"byHour":[{"hour":"2026-11-09T15:00:00.000Z","visits":2},"…7 more"],"visitorTopics":[{"value":"observability","count":14},"…9 more"],"visitorLevels":[{"value":"Deployment","count":19},"…4 more"],"recentVisitors":[{"player":{"id":"pl_…","handle":"otelotter","faceSeed":"otelotter","level":4,"levelName":"Cluster","xp":610,"banners":["welcomer","scout"]},"at":"2026-11-09T21:39:02.000Z","firstTimer":false},"…11 more"],"hereNow":[{"id":"pl_…","handle":"otelotter"},"…2 more"],"quests":{"offered":14,"accepted":9,"completed":6,"not_now":3,"declined":2},"rank":{"position":4,"of":61},"generatedAt":"2026-11-09T21:42:10.512Z"}
```

Draw `scanUrl` as the booth's check-in QR (the same printed token as the table QR, so a photo of it works all conference). A visit is a booth scan (`outpost` XP event, plus any `check_in` there). `now` is distinct players in the last 20 minutes; `today` starts at midnight in `conferenceTimeZone`; `byHour` buckets today's visits per hour (UTC `hour`, show it in `conferenceTimeZone`). `visitorTopics` and `visitorLevels` are counts over everyone who has visited (top 10). `recentVisitors` (newest first, one per player, up to 20) and `hereNow` only list players with meeting on who are not hidden from the leaderboard; everyone else is in the counts only. `quests` counts booth quests for this booth by status. `rank` is this booth's place by unique visitors today among booths with a visit today, or `null` before its first visit. The key is checked first: a wrong key is `403 bad_key` (`"That link doesn't open this booth's dashboard. Ask the organizers for your booth's staff link."`) even for a missing booth; then `404 unknown_outpost`. Variants: `quiet` (no visits: zeros, empty lists, `rank: null`), `bad_key` and `unknown_outpost`. Latency: about 0.4 to 0.8 s.

### admin_overview (organizer)

`{"key":"<admin-key>"}`, or with `"since":"2026-11-09T00:00:00Z"` →

```json
{"stats":{"players":20,"checkInsToday":31,"xpToday":1820,"…":"the organizer_stats output"},"exhibitors":{"total":320,"sponsors":234,"projects":86,"visitedToday":75,"visitsToday":760,"uniqueVisitorsToday":212},"byTier":[{"value":"Diamond","exhibitors":9,"visits":185},"…8 more"],"byZone":[{"value":"Cosmic Canyon","exhibitors":122,"visits":232},"…5 more"],"table":[{"exhibitor":{"id":"outpost-amazon-web-services","name":"Amazon Web Services","tier":"Diamond","boothNumber":"115","visitorsNow":6,"…":"an exhibitor card"},"visitsToday":63,"uniqueToday":55,"questsCompleted":9,"staffUrl":"https://kube-quest.cnh.radarhq.io/exhibitor/outpost-amazon-web-services?k=<staff-key>","scanUrl":"https://kube-quest.cnh.radarhq.io/r/outpost-amazon-web-services?t=<signed-token>"},"…318 more"],"generatedAt":"2026-11-09T21:42:10.512Z"}
```

`stats` is exactly `organizer_stats` with the same `since`. Booth visits are counted since `since`, or since midnight in `conferenceTimeZone`. `byTier` is in tier order; `byZone` is busiest first. `table` has every booth, busiest first (then tier order, then booth number); "quiet booths" are the rows with `visitsToday` 0. `questsCompleted` counts completed booth quests at that booth over the conference. `staffUrl` carries that booth's real staff key, so this view is for organizers only. A wrong key is `403 bad_key` (`"That link doesn't open the organizer view."`). Variant: `bad_key`. The full fixture is 250 KB; poll it every 30 s at most. Latency: about 0.6 to 1.2 s (`organizer_stats` plus three aggregations).

### Handshake (phone to phone)

A handshake is how two players prove they met: B shows a QR, A scans it, A asks B one question out loud, and both type the answer. Matching answers complete the handshake, award XP to both and mark any accepted meet between them `met`. Campfires stay as meeting places, but scanning one completes nothing.

1. **B** calls `handshake_code` and draws `scanUrl` as a QR. Refresh it every 50 s (it lives 60 s and is single use). While it is on screen, poll `handshake_state` without an id every 2 s; when it returns a `handshake`, switch to the answer screen and poll with that id.
2. **A** scans the QR. It opens `/h/<token>`; take the token from the path and call `start_handshake`. A sees the `question` (about B) and `questionReason`.
3. **B** locks in an answer (`answer_handshake`), then says it out loud. B answers once.
4. **A** types what they heard (`answer_handshake`). A gets 2 tries. If A submits before B, A's answer waits and is checked when B locks in.

Answers are compared after lowercasing, removing punctuation and a leading "a", "an" or "the". They match when they are equal, within a small edit distance (20% of the longer answer, at least 1), or, for multi-word answers, when 60% of the words overlap. Answers stay hidden (`myAnswer`, `theirAnswer` absent) until `status` leaves `waiting`.

The question is chosen from Elasticsearch data in this order: a topic both players share (`shared_topic`), B's booth notes (`booth_note`), talks B checked in to (`talk`), what B is working on (`working_on`), else a fixed list (`fallback`). The asker's `question` names B (`"Ask @otelotter: …"`); the answerer's `question` is the same question in the second person.

### handshake_code

`{"attendeeId":"p_…"}` →

```json
{"playerId":"pl_aeea8bd684c45f90","token":"<signed-token>","scanUrl":"https://kube-quest.cnh.radarhq.io/h/<signed-token>","expiresAt":"2026-11-09T21:20:21.447Z"}
```

The token is URL-safe (base64url parts joined by dots).

### start_handshake

`{"attendeeId":"p_…","token":"<signed-token>"}` → the handshake from the asker's view:

```json
{"id":"hs-d6bd862c723d14f0b6469479","role":"asker","partner":{"id":"pl_aeea8bd684c45f90","handle":"otelotter","…":"…"},
 "question":"You both work on observability. Ask @otelotter: which observability tool do they reach for first?","questionSource":"shared_topic","questionReason":"You both care about observability",
 "expiresAt":"2026-11-09T21:24:21.448Z","status":"waiting","statusLine":"Ask @otelotter the question out loud, then type what you heard.","iAnswered":false,"partnerAnswered":false,"attemptsLeft":2}
```

A handshake lasts 5 minutes. Scanning the same code again returns the same handshake. Errors: `403 expired_token` (the code refreshed; scan again), `403 bad_signature`, `400 self_handshake`, `409 code_used` (another player already used this code), `409 already_shook_hands` (this pair already matched today; no second XP), `409 no_match` (one blocked the other). Measured at 3.5 s against live Elastic (it includes up to 1.5 s for optional AI phrasing), so show a spinner.

### handshake_state

`{"attendeeId":"p_…","handshakeId":"hs-…"}` → `{"handshake": IHandshake}` from the caller's view. Without `handshakeId` it returns the caller's newest open (`waiting`, unexpired) handshake, or `{}`. A handshake past `expiresAt` reads `expired`.

### answer_handshake (awards XP)

`{"attendeeId":"p_…","handshakeId":"hs-…","answer":"otel collector"}` (1 to 60 characters). Returns the handshake from the caller's view. When it matches:

```json
{"id":"hs-d6bd862c723d14f0b6469479","role":"asker","status":"matched","statusLine":"Handshake complete! You and @otelotter are connected. +50 XP.","iAnswered":true,"partnerAnswered":true,"attemptsLeft":0,
 "matchedAt":"2026-11-09T21:19:26.597Z","myAnswer":"otel collector","theirAnswer":"The OTel Collector!","xpAwarded":50,"meetId":"meet-4c2b89f53c32d32090bdc992","…":"…"}
```

| Case | Result |
|---|---|
| Answerer locks in | `waiting`, `iAnswered: true`, `"Locked in. Now tell @ebpfennec your answer."` |
| Asker answers before the answerer | `waiting`, `iAnswered: true`, `partnerAnswered: false`, `"Got it. Waiting for @otelotter to lock in their answer."` |
| Miss with a try left | `waiting`, asker `iAnswered: false`, `partnerAnswered: true`, `attemptsLeft: 1`, `"That didn't match. Ask @otelotter again: 1 try left."` |
| Second miss | `mismatched`, both answers revealed |
| Match | `matched`, 50 XP each (+25 each when one is a first-timer), `meetId` when an accepted meet existed |
| Match after 6 handshake awards this hour | `matched`, `xpAwarded: 0`, the status line says why |

Errors: `409 already_answered` (the answerer already locked in), `409 handshake_closed`, `404 unknown_handshake`. Every case is in `fixtures/answer_handshake.json`.

### save_booth_note (awards XP)

`{"attendeeId":"p_…","locationId":"outpost-dash0","liked":"Jumped from a slow span to the pod logs in one click.","thoughts":"optional","followUp":true}`. `liked` and `thoughts` are up to 1000 characters each. Saving again edits the note. →

```json
{"note":{"id":"bn-1f0c6a2d9e8b47c3a5d1e2f3","locationId":"outpost-dash0","boothName":"Dash0","boothNumber":"134","sponsorTier":"Platinum","liked":"Jumped from a slow span to the pod logs in one click.","followUp":true,"xpAwarded":10,"createdAt":"2026-11-09T21:19:28.101Z","updatedAt":"2026-11-09T21:19:28.101Z"},
 "xpAwarded":10,"message":"+10 XP for your note on Dash0. It's in your summary.","newBanners":[]}
```

A booth earns 10 XP once, only when `liked` plus `thoughts` is at least 20 characters, the daily limit of 5 booth awards isn't reached, and the last booth XP was at least 3 minutes ago. Otherwise the note is saved with `xpAwarded: 0` and `message` says why (`variants`: `too_short`, `too_soon`, `daily_cap`). `levelUp` appears when the player levelled up. A location that is not an outpost returns `404 unknown_outpost`.

### list_booth_notes

`{"attendeeId":"p_…"}` → the player's notes, newest first (`IBoothNote[]`, as in `save_booth_note`).

### upload_booth_photo (awards XP)

`{"attendeeId":"p_…","locationId":"outpost-dash0","image":"data:image/jpeg;base64,…","caption":"Trace demo on the big screen"}` (`caption` optional, up to 120 characters) →

```json
{"photo":{"id":"bp-788d73e24c904880a7c7017a","locationId":"outpost-dash0","boothName":"Dash0","url":"/api/booth-photos/bp-788d73e24c904880a7c7017a.jpg","width":1024,"height":768,"caption":"Trace demo on the big screen","uploader":{"publicId":"pl_a8ee82eb252c214a","handle":"otelotter","faceSeed":"3a4944e6942be021"},"createdAt":"2026-11-09T22:19:02.118Z","mine":true},
 "xp":15,"questCompleted":true,"message":"+15 XP · photo added to the Dash0 booth on the map","newBanners":[]}
```

Fair play: the player must have scanned that booth's QR (an outpost scan, or a `check_in`/`outpost` XP event there) in the last 30 minutes, otherwise `403 not_at_booth`. At most 3 photos per player per booth (`429 photo_limit_booth`) and 10 per day (`429 photo_limit_day`). The image is a JPEG, PNG or WebP data URL of at most 400 KB, at most 2048 px on the long edge; the server reads the size from the file header (`415 unsupported_image`, `413 image_too_large`). This route alone accepts bodies up to 600 KB; the app resizes to 1024 px and JPEG quality 0.75 first. XP is 15, paid once per player per booth (`awardXpOnce` key `photo-<attendeeId>-<locationId>`); a later photo of the same booth has `xp: 0`. Photos are stored in `booth_notes` with `kind: "photo"` (the image is a `binary` field: stored, not indexed) and never appear in `list_booth_notes` or the recap. Show the line "Photograph the booth, not people. Don't capture faces or badges." before the camera opens.

### list_booth_photos

`{"locationId":"outpost-dash0","attendeeId":"p_…","limit":12}` (`attendeeId` and `limit` optional; `limit` 1 to 30, default 12) → `{"locationId":"outpost-dash0","photos":[IBoothPhoto…],"count":3}`, newest first, hidden photos left out. The list never includes image bytes: draw each `url`. Uploaders appear only as `publicId`, `handle` and `faceSeed`. With `attendeeId`, each photo has `mine` (show Delete instead of Report).

### report_booth_photo

`{"attendeeId":"p_…","photoId":"bp-…"}` → `{"photoId":"bp-…","reports":1,"hidden":false,"message":"Thanks. We noted your report."}`. Each player counts once; 2 reports hide the photo. Reporting your own photo is `409 own_photo`.

### delete_booth_photo

`{"attendeeId":"p_…","photoId":"bp-…"}` → `{"photoId":"bp-…","deleted":true}`. Only the uploader can delete (`404 unknown_photo` otherwise). Deleting does not take back XP, and a new photo of that booth does not pay again.

Sample photos for three booths (Dash0, Elastic, Docker), clearly labelled "SAMPLE", come from `npm run seed:photos`.

### send_message

`{"attendeeId":"p_…","meetId":"meet-…","text":"See you at the campfire in 5?"}` →

```json
{"id":"4097b15f-5638-4278-944b-997129851651","meetId":"meet-4c2b89f53c32d32090bdc992","fromMe":true,"text":"See you at the campfire in 5?","at":"2026-11-09T21:20:37.270Z"}
```

Only the two players in a meet that both accepted (`accepted` or `met`) can message. Plain text, trimmed, 1 to 500 characters, 20 per 10 minutes per sender. Errors: `409 meet_not_accepted`, `409 no_match` (blocked), `404 unknown_meet`, `429 slow_down`.

### list_messages

`{"attendeeId":"p_…","meetId":"meet-…","since":"2026-11-09T21:20:37.270Z"}` (`since` optional) → messages oldest first, each with `fromMe`. Neither player's id is ever included.

### recap

`{"attendeeId":"p_…"}` → `IRecap`: `player`, `totals` (`xp`, `talks`, `people`, `booths`, `quizCorrect`), `talks` (check-ins with the best quiz score), `people` (one per handshake partner: handle, the question, their answer, shared topics, `githubLogin` only when the two also accepted a meet), `booths` (from notes), a `nextStep` on every person and booth, an overall `nextSteps` list, and `emailSubject` plus `emailHtml` (a self-contained 600 px email). Next steps are rule-based: a follow-up booth becomes "Book a follow-up with Elastic.", a person with a shared topic becomes "Follow up with @otelotter about observability.". The full mock is `fixtures/recap.json`; the rendered email is `docs/mock/recap-email.html` (regenerate with `npx tsx scripts/render-recap-mock.ts`).

### Connections, links and private notes

A **connection** is created when a meet becomes `met` or a handshake completes (`answer_handshake` records it; `list_connections` also backfills any it missed). There is one per pair, stored in the `messages` index as `kind: "connection"` with a deterministic id (`conn-` plus a hash of the two attendee ids). Private notes live next to them as `kind: "connection_note"` (in `messages`) and `kind: "talk_note"` (in `booth_notes`); every query on those indices filters by `kind`, so chat messages, notifications, handle reservations, booth notes, booth photos and these never mix. No response carries another player's `attendeeId`: people are public ids (`pl_…`).

**Who sees links:** the player themselves, and players they are connected with. Everyone else gets `visible: false` and empty links. Notes are only ever returned to their author.

### update_links

`{"attendeeId":"p_…","links":{"linkedin":"linkedin.com/in/john-doe-platform","github":"argoproj","bluesky":"bsky.app/profile/bsky.app","website":"https://kubequest.cnh.radarhq.io"}}` →

```json
{"links":{"linkedin":"https://www.linkedin.com/in/john-doe-platform","github":"https://github.com/argoproj","bluesky":"https://bsky.app/profile/bsky.app","website":"https://kubequest.cnh.radarhq.io/"},
 "items":[{"network":"linkedin","label":"in/john-doe-platform","url":"https://www.linkedin.com/in/john-doe-platform"},"…3 more"],
 "enrichment":[{"network":"github","status":"added","summary":"GitHub @argoproj (Argo Project). …"},{"network":"bluesky","status":"added","summary":"Bluesky @bsky.app (Bluesky). …"}]}
```

Networks: `linkedin` (`linkedin.com/in/<slug>` or a bare slug), `github` (login or `github.com/<login>`), `x` (`@handle`, `x.com/…` or `twitter.com/…`, stored as x.com), `bluesky` (a handle or `bsky.app/profile/<handle>`), `mastodon` (`@user@host` or `https://host/@user`) and `website` (`https://` only). Only keys you send change; an empty string removes that link. Anything else is `400 invalid_input` with a per-network message (`variants.invalid_link`). When the GitHub or Bluesky link changes, the server reads the public profile (GitHub REST `users/:login` plus top repo languages; Bluesky `app.bsky.actor.getProfile` on `public.api.bsky.app`; 4 s timeout each) and appends a "Public profile:" paragraph to `profileText`, so Jina matching uses it. `status` is `added`, `not_found` or `unavailable`; `enrichment` is `[]` when neither link changed (as in the fixture, captured on a re-save). LinkedIn and X are never fetched.

### get_links

`{"viewerId":"p_…","targetPublicId":"pl_01c88990a33676aa"}` → for the owner or a connection:

```json
{"publicId":"pl_01c88990a33676aa","handle":"johndoe","isOwner":false,"isConnection":true,"visible":true,"links":{"…":"…"},"items":[{"network":"linkedin","label":"in/john-doe-platform","url":"https://www.linkedin.com/in/john-doe-platform"},"…3 more"]}
```

`githubVerified` is `true` when the GitHub link was confirmed through `/auth/github/callback`; the GitHub entry in `items` (here and in `list_connections`) then carries `"verified":true`, which the cards show as a small check.

For anyone else (`variants.not_connected`): `{"visible":false,"links":{},"items":[],"hiddenReason":"Links are shared only with people you have met through a meet or a handshake.", …}`.

### list_connections

`{"attendeeId":"p_…"}` → newest first:

```json
[{"id":"conn-e9b2965802616bd7cd20cf00",
  "player":{"id":"pl_aeea8bd684c45f90","handle":"otelotter","faceSeed":"otelotter","level":3,"levelName":"Node","xp":255,"banners":["welcomer"],"headline":"OpenTelemetry contributor; tracing all the things.","workingOn":"…","topics":["opentelemetry","…"]},
  "links":[{"network":"github","label":"@open-telemetry","url":"https://github.com/open-telemetry"},"…3 more"],
  "source":"meet","where":{"id":"campfire-learning-lounge","name":"Learning Lounge"},"metAt":"2026-11-09T21:43:54.000Z",
  "chatPrompt":"Ask @otelotter which OpenTelemetry Collector processors they would never run without.","sharedTopics":["observability"],
  "note":{"talkedAbout":"Tail sampling in the Collector, …","nextSteps":"Try the k8sattributes processor …","followUpBy":"2026-11-12T22:23:12.000Z","updatedAt":"…"}},"…1 more"]
```

`source` is `meet` or `handshake`; `where` is the meet's campfire, or the asker's last scanned place for a handshake without a meet. `realName` appears when the other player entered one. `note` is the caller's own note and is absent until they write one.

### save_connection_note

`{"attendeeId":"p_…","connectionId":"conn-…","talkedAbout":"…","nextSteps":"…","followUpBy":"2026-11-12T22:23:12.000Z"}` (`talkedAbout` and `nextSteps` up to 2000 characters, `followUpBy` optional ISO date) → the connection as in `list_connections`, with the saved `note`. Saving again replaces the note. A connection the caller is not part of returns `404 unknown_connection` (`variants.not_yours`).

### save_talk_note

`{"attendeeId":"p_…","talkId":"kc26-tue-tracing-at-scale","note":"…","takeaways":["…"]}` (`note` up to 2000 characters, up to 10 takeaways of 280) →

```json
{"id":"tn-a1ce7976235c488945228131","talkId":"kc26-tue-tracing-at-scale","talkTitle":"Tracing at Scale: Running a 16 Billion Spans/Hour Pipeline at Nubank","speakers":["Felipe Araujo (Nubank)","Kaynan Coelho (Nubank)"],"room":"Grand Ballroom ACE","start":"2026-11-10T14:50:00-07:00","note":"Nubank runs 16B spans an hour …","takeaways":["Shard the Collector by trace id before tail sampling","…2 more"],"createdAt":"…","updatedAt":"…"}
```

One note per player and talk; saving again edits it. Unknown talk: `404 unknown_talk`.

### list_talk_notes

`{"attendeeId":"p_…","talkId":"…"}` (`talkId` optional) → the caller's talk notes, newest first.

### list_notifications

`{"attendeeId":"p_…","limit":20}` (`limit` optional, 1 to 50, default 20) → `{ items, unread }`, newest first:

```json
{"items":[{"id":"match:pl_b0f34ffaf6282124","type":"new_match","title":"You and @argoalpaca both work on gitops","body":"Both into gitops","link":"/people","createdAt":"2026-11-09T22:14:36.020Z","readAt":null},{"id":"quest:8189074aa2c4fd8e","type":"new_quest","title":"New quest: Visit Dash0","body":"It covers operations.","link":"/quests","createdAt":"2026-11-09T22:14:35.202Z","readAt":null}],"unread":2}
```

`type` is one of `new_quest` and `new_match` (written by the `nudge` CronJob every 10 minutes), `meet_offer` (someone proposed a meet to you), `meet_accepted` (both said yes; sent to both players) and `banner` (a new banner). `link` is an in-app path to open on tap. Notifications carry only handles, public ids and public text, never another player's attendee id. They live in the `messages` index with `kind: "notification"`, under the id `notif:<attendeeId>:<id>`, written create-only so a rerun never duplicates one.

### mark_notifications_read

`{"attendeeId":"p_…","ids":["quest:8189074aa2c4fd8e"]}` or `{"attendeeId":"p_…","all":true}` → `{"marked":1,"unread":1}`. Unknown ids are skipped. Errors: `400 invalid_input` when neither `ids` nor `all: true` is passed.

### The nudge CronJob

`deploy/cronjob-nudge.yaml` runs `node scripts/dist/nudge.js` every 10 minutes with the app image. For every player seen in the last 3 hours or created today it reads `quest_board` and `recommend_people` and writes up to 2 `new_quest` notifications per 30 minutes and 1 `new_match` per hour, skipping anything already sent. It prints the counts; a second run right after the first writes 0. Run it locally with `npm run build:scripts && node scripts/dist/nudge.js` (reads `.env`).

## Demo flow (curl order used for this doc)

1. `sign_up` with `scanLocationId` and `scanToken`
2. `get_profile` (own, another player, then after the meet)
3. `update_settings`
4. `check_in`: a room, a repeat, a bad token, an outpost (awarded), a repeat, a token for the wrong place, the screen-token room, then a campfire for both meet players
5. `screen_token` and `GET /api/screen-token/:id`
6. `whats_around_me`, `whats_next`, `search` (twice), `recommend_talks`, `recommend_people`
7. `quest_board`, `respond_quest` (accept, then not_for_me), `make_quest`
8. `quiz_for_talk`, `submit_quiz` (twice), `boss_state` (three ways)
9. `propose_meet`, `list_meets`, `respond_meet` (as the partner), `list_meets`
10. `leaderboard` (overall and connectors), `inventory`, `world`, `organizer_stats`
11. Errors: invalid input, unknown attendee, unknown tool

Every response is in `resources/fixtures/`.
