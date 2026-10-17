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
| Winding down a session / high context / unrelated request — exit steps + follow-up prompt template (in this section) | § Checkpoint Handoff | `references/session-checkpoint-handoff/` |
| A parallel session is running, or an unrelated request just arrived | § Checkpoint Handoff | `references/session-checkpoint-handoff/parallel-session-disjoint-artifacts.md` |
| Deciding whether to checkpoint now; next-session opener; anti-patterns | § Checkpoint Handoff | `references/session-checkpoint-handoff/context-budget-and-boundary.md` |
| Syncing OpenSpec delta specs to main specs — reconcile against the implementation first | § OpenSpec Pre-Sync | `references/openspec-presync-delta-reconciliation/drift-causes-and-example.md` |

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

---

## Checkpoint Handoff

_(formerly `session-checkpoint-handoff` — references live under `references/session-checkpoint-handoff/`)_

**Extracted:** 2026-10-05

A session boundary is only useful when it is **verified** and **self-describing**. The next session recovers state from durable artifacts, in order of authority: **git commits** (the diff *is* the handoff), **learned skills + `AGENTS.md`**, and the retained, searchable old session (only when the first two miss something). A boundary taken mid-work forces the next session to re-derive half-finished state — strictly worse than continuing or compacting.

### Hard rules

1. **Never start new work at high context.** Only finish what is already in flight; defer the rest into the follow-up prompt.
2. **Never pollute the running session with unrelated work.** An unrelated request starts a fresh session, even when it looks quick — see `references/session-checkpoint-handoff/parallel-session-disjoint-artifacts.md`.
3. **Keep parallel sessions' artifacts disjoint.** Explicit pathspecs, scoped tooling, per-session branches/worktrees — detail in `references/session-checkpoint-handoff/parallel-session-disjoint-artifacts.md`.
4. **End only at a preliminary finish point.** Typecheck + tests green (`npm run typecheck`, `npm test`), then commit.
5. **Carry only what cannot be re-derived** — normally exactly one hard bug, as a failing (or skipped/xfail) test plus a note with symptom, minimal repro, and what was ruled out. Never memory alone.
6. **Do not bail with an arbitrary open task.** That recreates the non-green, non-self-describing boundary this protocol exists to prevent.
7. **The agent emits the follow-up prompt at exit** (template below); the user never has to reconstruct "what's left".

### Exit sequence

1. Inventory the in-flight work. Separate "must finish for the tree to be consistent" from "would be nice".
2. Finish only the first group. Open nothing new.
3. Verify: typecheck + tests green. If not reachable cheaply, make the boundary explicit instead — WIP commit on a branch plus a one-line note of what is half-done.
4. Commit the checkpoint. The message states what is complete and what is intentionally incomplete.
5. Materialize the carried hard bug (failing test + symptom / minimal repro / ruled-out note).
6. Emit the follow-up prompt (template below).
7. If the session produced a durable lesson, record it as a learned skill before closing.

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

For the context-budget heuristic (whether to checkpoint now), the next-session opener, and the anti-pattern list, see `references/session-checkpoint-handoff/context-budget-and-boundary.md`.

### When to Use

- Context is high and the user wants to wind down or start fresh.
- The user asks for a "follow-up prompt", a "safe exit", or "what's left".
- A task is complete enough to review/learn/commit and a new session is next.
- An unrelated request arrives while this session is focused — start a fresh session rather than appending it (see `references/session-checkpoint-handoff/parallel-session-disjoint-artifacts.md`).
- Never mid-work: finish the runnable unit or explicitly mark the boundary first.

---

## OpenSpec Pre-Sync

_(formerly `openspec-presync-delta-reconciliation` — references live under `references/openspec-presync-delta-reconciliation/`)_

**Extracted:** 2026-06-05

After implementing an OpenSpec change, the delta specs may no longer match the actual implementation — code review removes/renames fields, UX simplification drops UI elements, technical constraints force a simpler approach. Syncing outdated delta specs creates main specs that describe features, fields, or behaviors that don't exist.

Before syncing, reconcile the delta against the implementation:

1. **Read the delta spec** to understand what was originally planned.
2. **Compare with the actual implementation** — check controllers, schemas, UI components.
3. **Update the delta spec** to match reality: remove/rename changed requirements and scenarios, add newly discovered ones, correct field/column/label names.
4. **Sync the reconciled delta spec** to main specs.

For drift causes and a worked before/after example, see `references/openspec-presync-delta-reconciliation/drift-causes-and-example.md`.

### When to Use

- Before running `openspec-sync-specs` for any completed change
- When code review feedback modified the original design
- When implementation discovered constraints not in the original spec
- When the UI or API surface differs from what was initially spec'd
