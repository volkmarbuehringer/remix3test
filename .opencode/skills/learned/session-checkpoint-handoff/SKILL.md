---
name: session-checkpoint-handoff
description: "Use when winding down a working session, when context is already high, or when an unrelated request arrives in a focused session — drive the running work to a verified checkpoint (typecheck + tests green, committed), start no new work, keep unrelated work in a fresh session with artifacts disjoint from any parallel session, carry only a hard bug as an executable artifact, and emit a self-contained follow-up prompt for the next session."
origin: auto-extracted
---

# Session Checkpoint Handoff

**Extracted:** 2026-10-05

**Context:** A long-running DSH workflow: finish a task with its afterwork (review, learn, commit), then start a fresh session with a clean perspective. Restarts are cheap because durable artifacts carry the state — git commits, learned skills, and the retained, searchable old session. The rule that keeps it working: a session only ends at a verified checkpoint, never mid-work, and never with freshly started work.

## Core principle

A session boundary is only useful when it is **verified** and **self-describing**. The value of starting fresh is proportional to how cheaply the next session can recover the state. A boundary taken mid-work forces the next session to re-derive half-finished state from scratch — strictly worse than continuing or compacting.

Durable state, in order of authority:

- **git commits** — the code state; the diff *is* the handoff.
- **learned skills + `AGENTS.md`** — conventions and gotchas the fresh session auto-loads.
- **the old session** — a searchable reasoning trail (DSH keeps it), used only when the first two missed something.

## Hard rules

1. **Never start new work at high context.** Only finish what is already in flight. New features, new exploration, and "while I'm here" fixes are deferred into the follow-up prompt.
2. **Never pollute the running session with unrelated work.** A request that is not part of this session's task starts a fresh session, even when it looks quick. Unrelated work mixes diffs, muddies the review/learn/commit step, and spends context the current checkpoint needs.
3. **Keep parallel sessions' artifacts disjoint.** When unrelated work runs in another session at the same time, each session stages, commits, and writes only its own files and skills. Never let one session's tooling or staging reach into the other's changes.
4. **End only at a preliminary finish point.** Typecheck + tests green (`npm run typecheck`, `npm test`), then commit.
5. **Carry only what cannot be re-derived.** Normally that is exactly one thing: a known difficult hard bug.
6. **Do not bail with an arbitrary open task.** That recreates the non-green, non-self-describing boundary this protocol exists to prevent.
7. **The agent produces the follow-up prompt at exit.** The user should not have to reconstruct "what's left" — emit it as the seed for the next session.

## Unrelated work opens a new session

A request that is not part of the current session's task does **not** belong here — not even a quick one. Fresh sessions are cheap (durable artifacts carry the state), so there is no reason to append unrelated work to a focused session:

- It contaminates the working tree and the eventual commit with changes that do not belong to this task.
- It forces the review/learn step to reason about two unrelated things at once.
- It spends the context budget this session needs to reach its checkpoint.

When an unrelated request arrives, do not "fit it in": open a new session and handle it there. The one exception is a true blocker of the current task — then it is related work by definition.

## Parallel sessions keep artifacts disjoint

A fresh session for unrelated work may run alongside another active session — that is allowed, but never create an artifact that mixes the two. Shared mutable state (the working tree, the index, generated files, shared skills) is the risk, and a checkpoint is exactly when it surfaces:

- **Commits:** stage explicit pathspecs (`git add <your files>`). Never `git add -A` or `git commit -a` while another session may have uncommitted work — that would capture their changes under your message. If both sessions edited the same file, serialize: coordinate before either commits.
- **Formatter / build / generated output:** a repo-wide `format:fix` or generator can rewrite the other session's files. Scope tooling to your own edit set; see the `format-fix-diff-triage` skill for separating formatter noise from real content.
- **Skills, `AGENTS.md`, docs:** only the session whose work produced the lesson writes it. Never capture the parallel session's context into a shared skill.
- **Verification:** typecheck/tests can fail because of the other session's in-flight edits. Verify against your own change and report it, rather than "fixing" their work.
- **Branch / worktree:** prefer a separate branch or worktree per parallel session; at minimum keep every commit's pathspec to your own change.

## Exit sequence

1. Inventory the in-flight work. Separate "must finish for the tree to be consistent" from "would be nice".
2. Finish only the first group. Open nothing new.
3. Verify: typecheck + tests green. If that is not reachable cheaply, make the boundary explicit instead — WIP commit on a branch plus a one-line note of what is half-done.
4. Commit the checkpoint. The message states what is complete and what is intentionally incomplete.
5. Materialize the carried hard bug: a failing test (or a skipped/xfail test when the suite must stay green) plus a note with symptom, minimal repro, and what was already ruled out. Never carry it as memory alone.
6. Emit the follow-up prompt (template below) into the chat.
7. If the session produced a durable lesson, record it as a learned skill before closing.

## Context budget heuristic

Raw percent is a proxy, not the trigger. Decide by:

- **Distance to the next green checkpoint.** Small and known → continue. Open-ended exploration → bank the current checkpoint first.
- **Uncommitted tacit state.** High context + low tacit state → safe to push. High context + high tacit state → checkpoint now.

A fixed threshold (for example "stop near 50%") is a blanket proxy for "the remaining work is large and unknown". Keep it as a tripwire, not as the decision.

## Follow-up prompt template

```
Continue in <workspace>.

Handoff: commit <sha>; typecheck <pass/fail>; tests <pass/fail>.
Completed: <what is done and verified>
Intentionally incomplete: <what and why>
Carried hard bug: <symptom> | repro: <steps> | ruled out: <what was tried and failed>
Next action: <the single next concrete step>
Definition of done: typecheck + tests green + <task-specific>
Context: read commit <sha> — the diff is the handoff. The previous session is retained and searchable if a detail is missing.
```

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

## When to Use

- Context is high and the user wants to wind down or start fresh.
- The user asks for a "follow-up prompt", a "safe exit", or "what's left".
- A task is complete enough to review/learn/commit and a new session is next.
- An unrelated request arrives while this session is focused — start a fresh session rather than appending it.
- Unrelated work is being handled in a parallel session — keep staged files, commits, generated output, and skills disjoint between the two.
- Never mid-work: finish the runnable unit or explicitly mark the boundary first.
