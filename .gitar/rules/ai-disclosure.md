---
title: "AI Disclosure"
description: "Every PR states how AI was used to write it"
type: check
when: "Any pull request is opened or its description changes"
actions: "Fail the check and comment if the AI-disclosure line is missing or left blank"
---

# AI Disclosure

The PR template has a line that starts with `**AI disclosure:**`. The check passes when the PR description contains that line followed by a real answer, for example "Written with Claude Code, reviewed by Golden" or "No AI used".

The check fails when the line is missing, or when it still holds the template placeholder text. On failure, post one comment asking the author to fill it in.
