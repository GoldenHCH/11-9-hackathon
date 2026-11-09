# Phase 06 — Phone-to-phone handshakes, booth notes, messages and the recap

> **Status (14:50 MST): merged as PR 16 and live** (`/healthz` reports `0110194`). Renamed from `phase-05-handshake-booth-notes.md`, because three plans were all numbered 05. The backend boxes below are ticked from the merged code. The "Done when" checks on two phones have not been run yet; run them before the demo rehearsal, since the handshake is now how the demo's meet completes.

**Goal:** a meet can't be faked from a screenshot or a group chat; booth scans turn into takeaways people actually wrote; two players who both opted in can plan their meet in the app; and everyone is promised a recap email of the people, booths and next steps from their conference.
**Brief requirements covered:** Hallway (mutual opt-in, meeting point, icebreaker, verified handshake), "makes conferences easier", Elastic as the core data layer (questions picked from profiles and notes, `semantic_text` notes), Merge Forward (no timers on the question, works with a pasted link instead of a camera, plain text), Dash0 (every tool emits a span).
**Depends on:** Phase 02 tools on main (meets, check-in, XP ledger, public ids).
**Owner:** Collin (with Claude). Branch `feat/handshake-notes`.

## Design decisions (from the team)

- **Handshake = phone to phone.** B shows a personal QR that rotates every 60 s (signed, single use). A scans it with the phone camera. Both phones get the same question about B, picked from Elasticsearch data: shared topics first, then B's booth notes, the talks B checked in to, what B is working on, then a fallback list. B secretly types a short answer; A asks out loud and types what they heard. Answers are compared after normalising (case, punctuation, articles) with small typos allowed. Match → 50 XP each (+25 first-timer bonus), and any accepted meet between them becomes `met`. A gets 2 tries; questions expire after 5 minutes.
- **Campfires are meetup locations, not the proof.** A meet still proposes a campfire and a time. Completion comes from the handshake, wherever the two people actually find each other.
- **Messages only after mutual opt-in.** Two players can message once both said yes to a meet, to plan where and when. Plain text, 500 characters, rate-limited, and blocked players can't message.
- **Booth scans are notes, not staff quizzes.** Scanning a booth saves it to your notes. Writing what you liked and thought (20+ characters) earns 10 XP, at most 5 booths a day and at least 3 minutes apart, so people listen to the pitch instead of farming codes. Too fast still saves the note, just without XP.
- **Recap promise.** "After the conference we'll email you a summary of every booth, every person you met and your next steps." The recap tool builds it; `docs/mock/recap-email.html` is the mock email for the demo. Nothing is actually sent.

## Checklist

### Contract
- [x] Tool names, interfaces and game rules in `app/src/types/` (`handshake_code`, `start_handshake`, `handshake_state`, `answer_handshake`, `save_booth_note`, `list_booth_notes`, `send_message`, `list_messages`, `recap`)

### Backend (`app/src/`)
- [x] Signed, single-use, 60 s personal handshake tokens in `security/tokens.ts`
- [x] `handshakes` index; question picker over ES data with a non-AI fallback; fuzzy answer matcher with a focused test
- [x] XP through `awardXp` only; hourly handshake XP cap; accepted meet → `met`
- [x] `booth_notes` index with `semantic_text`; outpost check-in returns `noteRequired` and the note; `save_booth_note` XP rules
- [x] `messages` index; send and list only for mutually accepted meets
- [x] `recap` tool, email renderer, `GET /api/recap/:attendeeId/email.html`, `docs/mock/recap-email.html`
- [x] Fixtures for every new tool; `docs/api.md` and `docs/architecture.md` updated

### Web (`web/src/app/`)
- [x] `/code`: rotating personal QR, opens the question when someone scans it, paste-a-link fallback
- [x] `/h/:token` → `/handshake/:id`: asker and answerer views, attempts, matched, mismatched and expired states
- [x] `/r/:locationId`: check-in result; booth takeaways form for outposts
- [x] `/notes`: every booth note, editable
- [x] `/meets` and `/intro/:id`: meets list, opt-in accept/decline, the plan, messages
- [x] `/recap`: totals, next steps, people, booths, talks, email preview
- [x] `/me/:attendeeId`: the personal link signs you in

## Done when

- [ ] Two phones on the live URL: B shows `/code`, A scans, both see the same question, answers match, both get +50 XP and the meet shows "Met"
- [ ] Scanning a booth QR shows the takeaways form; a 20+ character note earns 10 XP; a second booth within 3 minutes saves without XP
- [ ] Two players with an accepted meet can message each other; a third player can't read or send
- [ ] `/recap` shows the people, booths and next steps, and the email preview matches `docs/mock/recap-email.html`
- [x] PR opened and reviewed by Gitar (PR 16, merged 14:32)
