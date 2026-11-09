---
title: "Game integrity"
description: "Signed check-ins, a single XP writer, and Hallway privacy"
type: check
when: "A pull request changes files under app/src/"
actions: "Fail the check and comment on the line when a change breaks one of the three rules below"
---

# Game integrity

1. **`check_in` must verify signed tokens.** Every check-in path calls `verifyLocationToken` and awards nothing when it fails.
2. **`awardXp` is the only writer to `xp_events`.** No code outside `app/src/xp/award.ts` indexes, updates or deletes XP events or edits an XP total.
3. **Never expose `photoUrl` or `spotMe` (the photo and "how to spot me" line) before mutual accept.** Only the confirmed partner of a meet both sides accepted may receive them.

On failure, post one comment per broken rule, naming the file, the line and the rule.
