# Context budget, opener, and anti-patterns

Formerly part of `session-checkpoint-handoff` (now § Checkpoint Handoff in `agent-ops`).

## Context budget heuristic

Raw percent is a proxy, not the trigger. Decide by:

- **Distance to the next green checkpoint.** Small and known → continue. Open-ended exploration → bank the current checkpoint first.
- **Uncommitted tacit state.** High context + low tacit state → safe to push. High context + high tacit state → checkpoint now.

A fixed threshold (for example "stop near 50%") is a blanket proxy for "the remaining work is large and unknown". Keep it as a tripwire, not as the decision.

## Next-session opener

Prefer opening the new session by **reviewing the committed work** (fresh perspective, no anchoring to the author's reasoning), then continuing from the follow-up prompt. The review costs nothing extra and often catches what the author session rationalized away.

## Anti-patterns

- Starting a fresh session mid-work "to be safe".
- Exiting with an arbitrary open task instead of landing a checkpoint.
- Carrying a hard bug as memory rather than a failing test or a ruled-out note.
- Starting new features when context is already high.
- Doing an unrelated side task in the running session "because it came up".
- Committing or formatting from one session while a parallel session has uncommitted work in the same tree (`git add -A`, repo-wide `format:fix`).
- Writing a shared skill or `AGENTS.md` from the session that did not produce the lesson.
- Treating a fixed context percentage as the sole trigger.
