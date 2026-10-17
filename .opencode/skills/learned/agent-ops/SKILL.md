---
name: agent-ops
description: "Use when writing agent instructions or ask_user/confirm UI (render confirm options as inline action buttons, exact output-format templates), winding down a working session / high context / an unrelated request mid-task (drive to a verified checkpoint: typecheck + tests green, committed; start no new work; disjoint artifacts from parallel sessions; carry only a hard bug as an executable artifact; emit a self-contained follow-up prompt), or syncing OpenSpec delta specs to main specs (reconcile the delta with the actual implementation first, or the docs land stale)."
user-invocable: false
origin: consolidated
---

# Agent Ops: Guidance UI, Checkpoint Handoff & OpenSpec Pre-Sync

Consolidated from 3 former learned skills (`agent-guidance`, `session-checkpoint-handoff`, `openspec-presync-delta-reconciliation`) on 2026-10-17. Reference files are namespaced under `references/<former-skill>/`. Everything vendor-supplied (guides, package READMEs, the vendor `remix` / `mastra` skills) stays authoritative — sections below are deltas only.

## Load Only The Sections You Need

| You need... | Section | References |
| --- | --- | --- |
| Writing agent instructions or ask_user/confirm UI — inline action buttons, output-format templates | § Guidance UI | `references/agent-guidance/` |
| Winding down a session / high context / unrelated request — verified checkpoint, artifact isolation, follow-up prompt | § Checkpoint Handoff | `references/session-checkpoint-handoff/` |
| Syncing OpenSpec delta specs to main specs — reconcile against the implementation first | § OpenSpec Pre-Sync | `references/openspec-presync-delta-reconciliation/` |

## Guidance UI

_(formerly `agent-guidance` — references live under `references/agent-guidance/`)_

**Consolidated from:** `agent-ask-user-action-buttons`, `agent-instruction-output-formatting`

Covers two aspects of guiding agent-user interaction:
1. Rendering `ask_user`/confirm options as inline action buttons instead of radio buttons
2. Specifying exact output format templates in agent instructions to prevent invented summaries

### Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Rendering `ask_user`/confirm options or clicking a choice in an agent chat UI | `references/agent-guidance/action-buttons.md` |
| Writing/reviewing agent instructions that relay tool data, or debugging an agent that invents generic summaries | `references/agent-guidance/output-formatting.md` |

### Core Rules

- **Action buttons**: single-select questions with ≤6 options render every option as a direct inline button that submits on click — no separate "Confirm" step.
- **Fallback**: multi-select or >6 options keep the checkbox/radio + Confirm pattern, since selecting multiple inline buttons is awkward.
- **Why**: radio buttons plus a separate "Confirm" button need two clicks and add visual noise; the "Confirm" button is superfluous because each option is already meaningful, and the text input already lets the user proceed without choosing an action.
- **Double-submit guard**: on first click, disable every button in the group rather than clearing the bubble (which creates a jarring visual gap).
- **Descriptions**: preserve each option description via the button `title` attribute.
- **Text input always remains**: the user can type a new message instead of clicking any button — never remove the input below the chat.
- **Specify the exact output shape** of every data-returning tool (the fields it returns), a template for presenting the data, and an explicit anti-pattern (a "do not" rule).
- **Underspecified "Report/Present the results"** instructions make an agent summarize generically, omit individual items in favor of aggregate counts, invent plausible-but-wrong summaries, and misplace tool output — a failure of instruction underspecificity.
- **Worked failure**: a Mastra workflow agent told to "Report the results" invented a generic German "alles in Ordnung" message instead of relaying the actual user names and pending appointment counts.
- **Pattern**: `<tool_name>: ... Returns <exact shape>` plus `You MUST <specific presentation rule>`, then `When presenting <check> results: If <condition>: "<exact template>" / Always include <required field>.`
- **Apply to**: consistency/validation tools, data query tools (user/appointment lists), and any tool that returns structured data for the agent to relay.

### When to Use

- Building an agent chat UI that renders `ask_user` / question options via SSE or similar streaming
- The question type is single-select (one choice) with a small set of options
- The agent presents confirmation prompts ("Confirm?", "Proceed?") where a single "Confirm" button suffices
- Writing or reviewing agent instructions for any LLM framework (Mastra, LangChain, OpenAI Assistants, custom)
- An agent consistently returns vague summaries instead of specific data from tool results
- Debugging "the tool returns correct data but the agent says something different"

### Related Skills

- `mastra-deltas § Agent` — SSE streaming transport that delivers `question` events to the chat UI
- `mastra-deltas § Tools` — tool design patterns (param self-lookup, single-job separation) that feed data into agent responses
- Output-format instruction templates — covered in Part 2 above.

---

## Checkpoint Handoff

_(formerly `session-checkpoint-handoff` — references live under `references/session-checkpoint-handoff/`)_

**Extracted:** 2026-10-05

**Context:** A long-running DSH workflow: finish a task with its afterwork (review, learn, commit), then start a fresh session with a clean perspective. Restarts are cheap because durable artifacts carry the state — git commits, learned skills, and the retained, searchable old session. The rule that keeps it working: a session only ends at a verified checkpoint, never mid-work, and never with freshly started work.

### Core principle

A session boundary is only useful when it is **verified** and **self-describing**. The value of starting fresh is proportional to how cheaply the next session can recover the state. A boundary taken mid-work forces the next session to re-derive half-finished state from scratch — strictly worse than continuing or compacting.

Durable state, in order of authority:

- **git commits** — the code state; the diff *is* the handoff.
- **learned skills + `AGENTS.md`** — conventions and gotchas the fresh session auto-loads.
- **the old session** — a searchable reasoning trail (DSH keeps it), used only when the first two missed something.

### Hard rules

1. **Never start new work at high context.** Only finish what is already in flight. New features, new exploration, and "while I'm here" fixes are deferred into the follow-up prompt.
2. **Never pollute the running session with unrelated work.** A request that is not part of this session's task starts a fresh session, even when it looks quick. Unrelated work mixes diffs, muddies the review/learn/commit step, and spends context the current checkpoint needs.
3. **Keep parallel sessions' artifacts disjoint.** When unrelated work runs in another session at the same time, each session stages, commits, and writes only its own files and skills. Never let one session's tooling or staging reach into the other's changes.
4. **End only at a preliminary finish point.** Typecheck + tests green (`npm run typecheck`, `npm test`), then commit.
5. **Carry only what cannot be re-derived.** Normally that is exactly one thing: a known difficult hard bug.
6. **Do not bail with an arbitrary open task.** That recreates the non-green, non-self-describing boundary this protocol exists to prevent.
7. **The agent produces the follow-up prompt at exit.** The user should not have to reconstruct "what's left" — emit it as the seed for the next session.

### Unrelated work opens a new session

A request that is not part of the current session's task does **not** belong here — not even a quick one. Fresh sessions are cheap (durable artifacts carry the state), so there is no reason to append unrelated work to a focused session:

- It contaminates the working tree and the eventual commit with changes that do not belong to this task.
- It forces the review/learn step to reason about two unrelated things at once.
- It spends the context budget this session needs to reach its checkpoint.

When an unrelated request arrives, do not "fit it in": open a new session and handle it there. The one exception is a true blocker of the current task — then it is related work by definition.

### Parallel sessions keep artifacts disjoint

A fresh session for unrelated work may run alongside another active session — that is allowed, but never create an artifact that mixes the two. Shared mutable state (the working tree, the index, generated files, shared skills) is the risk, and a checkpoint is exactly when it surfaces:

- **Commits:** stage explicit pathspecs (`git add <your files>`). Never `git add -A` or `git commit -a` while another session may have uncommitted work — that would capture their changes under your message. If both sessions edited the same file, serialize: coordinate before either commits.
- **Formatter / build / generated output:** a repo-wide `format:fix` or generator can rewrite the other session's files. Scope tooling to your own edit set; see the `dev-gotchas § Format Triage` skill for separating formatter noise from real content.
- **Skills, `AGENTS.md`, docs:** only the session whose work produced the lesson writes it. Never capture the parallel session's context into a shared skill.
- **Verification:** typecheck/tests can fail because of the other session's in-flight edits. Verify against your own change and report it, rather than "fixing" their work.
- **Branch / worktree:** prefer a separate branch or worktree per parallel session; at minimum keep every commit's pathspec to your own change.

### Exit sequence

1. Inventory the in-flight work. Separate "must finish for the tree to be consistent" from "would be nice".
2. Finish only the first group. Open nothing new.
3. Verify: typecheck + tests green. If that is not reachable cheaply, make the boundary explicit instead — WIP commit on a branch plus a one-line note of what is half-done.
4. Commit the checkpoint. The message states what is complete and what is intentionally incomplete.
5. Materialize the carried hard bug: a failing test (or a skipped/xfail test when the suite must stay green) plus a note with symptom, minimal repro, and what was already ruled out. Never carry it as memory alone.
6. Emit the follow-up prompt (template below) into the chat.
7. If the session produced a durable lesson, record it as a learned skill before closing.

### Context budget heuristic

Raw percent is a proxy, not the trigger. Decide by:

- **Distance to the next green checkpoint.** Small and known → continue. Open-ended exploration → bank the current checkpoint first.
- **Uncommitted tacit state.** High context + low tacit state → safe to push. High context + high tacit state → checkpoint now.

A fixed threshold (for example "stop near 50%") is a blanket proxy for "the remaining work is large and unknown". Keep it as a tripwire, not as the decision.

### Follow-up prompt template

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

### Next-session opener

Prefer opening the new session by **reviewing the committed work** (fresh perspective, no anchoring to the author's reasoning), then continuing from the follow-up prompt. The review costs nothing extra and often catches what the author session rationalized away.

### Anti-patterns

- Starting a fresh session mid-work "to be safe".
- Exiting with an arbitrary open task instead of landing a checkpoint.
- Carrying a hard bug as memory rather than a failing test or a ruled-out note.
- Starting new features when context is already high.
- Doing an unrelated side task in the running session "because it came up".
- Committing or formatting from one session while a parallel session has uncommitted work in the same tree (`git add -A`, repo-wide `format:fix`).
- Writing a shared skill or `AGENTS.md` from the session that did not produce the lesson.
- Treating a fixed context percentage as the sole trigger.

### When to Use

- Context is high and the user wants to wind down or start fresh.
- The user asks for a "follow-up prompt", a "safe exit", or "what's left".
- A task is complete enough to review/learn/commit and a new session is next.
- An unrelated request arrives while this session is focused — start a fresh session rather than appending it.
- Unrelated work is being handled in a parallel session — keep staged files, commits, generated output, and skills disjoint between the two.
- Never mid-work: finish the runnable unit or explicitly mark the boundary first.

---

## OpenSpec Pre-Sync

_(formerly `openspec-presync-delta-reconciliation` — references live under `references/openspec-presync-delta-reconciliation/`)_

**Extracted:** 2026-06-05
**Context:** Self-service appointments page where implementation diverged from specs (removed Endzeit field, removed ID column, removed text search). Delta specs must be updated before syncing.

### Problem

After implementing an OpenSpec change, the delta specs may no longer match the actual implementation. Syncing outdated delta specs to main specs creates inaccurate documentation that describes features, fields, or behaviors that don't exist. This leads to confusion in future sessions and erodes trust in the spec system.

Common causes of drift:

- Code review feedback removes/renames fields
- UX simplification removes UI elements (columns, filters, form fields)
- Technical constraints force a simpler approach than originally specified

### Solution

Before syncing delta specs to main specs, reconcile them against the actual implementation:

1. **Read the delta spec** to understand what was originally planned
2. **Compare with the actual implementation** — check controllers, schemas, UI components
3. **Update the delta spec** to match reality:
   - Remove or rename requirements/scenarios that changed
   - Add any new scenarios or constraints discovered during implementation
   - Correct field names, column names, and UI labels
4. **Sync the reconciled delta spec** to main specs

#### Example

**Before (outdated delta):**

```
#### Scenario: Create form has no user field
- **WHEN** user clicks "Neu"
- **THEN** the form panel shows fields: Ressource, Titel, Datum, Startzeit, Endzeit
```

**After (reconciled — Endzeit was removed, always 1 hour):**

```
- **THEN** the form panel shows fields: Ressource, Titel, Datum, Startzeit
- **THEN** the end time is always 1 hour after the start time (no end time selection)
```

### When to Use

- Before running `openspec-sync-specs` for any completed change
- When code review feedback modified the original design
- When implementation discovered constraints not in the original spec
- When the UI or API surface differs from what was initially spec'd
