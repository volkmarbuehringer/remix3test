---
name: agent-guidance
description: 'Agent interaction guidance — render ask_user/confirm options as inline action buttons, and specify exact output format templates in agent instructions'
origin: consolidated
---

# Agent Interaction Guidance

**Consolidated from:** `agent-ask-user-action-buttons`, `agent-instruction-output-formatting`

Covers two aspects of guiding agent-user interaction:
1. Rendering `ask_user`/confirm options as inline action buttons instead of radio buttons
2. Specifying exact output format templates in agent instructions to prevent invented summaries

---

## Part 1: Question Options as Action Buttons

### Problem

When an agent asks a question with a small set of single-select options (e.g., "Lock user 5?" with options `["Confirm"]` or `["Lock user 5", "Cancel"]`), rendering them as radio buttons + a separate "Confirm" button requires two clicks and extra visual noise. The "Confirm" button itself is superfluous — each option is already meaningful. If the user just wants to proceed without selecting an action, the text input is always available.

### Solution

When the question uses single-select mode and has 6 or fewer options, render each option as a direct inline action button. Clicking a button immediately submits that option's value without requiring a separate confirmation click.

```typescript
let useButtons = !isMulti && optionList.length <= 6

if (useButtons) {
  let btnGroup = document.createElement('div')
  btnGroup.style.display = 'flex'
  btnGroup.style.flexWrap = 'wrap'
  btnGroup.style.gap = '6px'

  for (let opt of optionList) {
    let optBtn = document.createElement('button')
    optBtn.textContent = opt.label
    optBtn.onclick = () => {
      btnGroup.querySelectorAll('button').forEach((b) => (b.disabled = true))
      handleAnswer(opt.label)
    }
    if (opt.description) {
      optBtn.title = opt.description
    }
    btnGroup.appendChild(optBtn)
  }
  el.appendChild(btnGroup)
} else {
  // Fall back to radio/checkboxes + Confirm button
  // for multi-select or large option sets (>6)
}
```

**Result:**

```
Before:                         After (≤6 single-select options):
┌──────────────────┐           ┌──────────────────────────┐
│ Lock user 5?     │           │ Lock user 5?             │
│ ◉ Lock user 5    │           │ [Lock user 5] [Cancel]   │
│ ◉ Cancel         │           └──────────────────────────┘
│ [Confirm]        │
└──────────────────┘
```

### Key details

- **Threshold**: ≤6 options, single-select only. Beyond that or multi-select, keep the checkbox + confirm pattern since selecting multiple inline buttons is awkward.
- **Double-submit guard**: Disable all buttons in the group on first click rather than clearing the bubble (which creates a jarring visual gap).
- **Descriptions**: Preserve option descriptions via `title` attribute on buttons.
- **Text input always remains**: The user can type a new message instead of clicking any button — the text input below the chat is never removed.

---

## Part 2: Agent Instructions Need Explicit Output Formatting

### Problem

When an LLM agent's instructions say "Report the results" or "Present the findings" without specifying the exact format, the agent often:

- Summarizes generically ("No issues found", "All good") even when the tool returned specific data
- Omits individual items and only reports aggregate counts
- Invents plausible-sounding but factually incorrect summaries
- Places tool output data in the wrong conversational context

This is a failure of **instruction underspecificity** — the LLM optimizes for brevity/fluency over data fidelity when not explicitly constrained.

**Real-world example:** A Mastra workflow agent was told "Report the results" after a consistency check tool ran. Instead of presenting the actual user names and pending appointment counts from the tool output, the agent invented a generic German "alles in Ordnung" (everything's fine) message — silently discarding the data.

### Solution

In agent instructions, always specify:

1. **The exact output shape** of the tool (what fields are returned)
2. **A template** for how to present data in the response
3. **An anti-pattern to avoid** (explicit "do not" rule)

### Before (vague — agent invents generic response)

```
- consistency_check: Run checks. Returns results.
- Report the results.
```

The agent responds: "All consistency checks passed. Everything looks good." (even when the tool returned `{ users: [{name: "Max", pendingCount: 3}] }`)

### After (specific — agent uses actual data)

```
- consistency_check: Run checks.
  Returns { users: { id, name, email, pendingCount }[], total }.
  You MUST present the actual users and counts — never invent a generic message.

- When presenting results: if users is empty say "No users found."
  If users has entries, say "{name}: {pendingCount} pending" for each.
  Always include the total count.
```

The agent responds: "2 users found: Max (3 pending), Erika (1 pending). Total: 4 pending appointments."

### Pattern Template

```
- <tool_name>: <description>
  Returns <exact shape>
  You MUST <specific presentation rule>

- When presenting <check> results:
  If <condition>: "<exact template>"
  Always include <required field>.
```

Apply this pattern to:
- Consistency/validation tools
- Data query tools (user lists, appointment lists, etc.)
- Any tool that returns structured data for the agent to relay

---

## When to Use

- Building an agent chat UI that renders `ask_user` / question options via SSE or similar streaming
- The question type is single-select (one choice) with a small set of options
- The agent presents confirmation prompts ("Confirm?", "Proceed?") where a single "Confirm" button suffices
- Writing or reviewing agent instructions for any LLM framework (Mastra, LangChain, OpenAI Assistants, custom)
- An agent consistently returns vague summaries instead of specific data from tool results
- Debugging "the tool returns correct data but the agent says something different"

## Related Skills

- `mastra-agent` — SSE streaming transport that delivers `question` events to the chat UI
- `mastra-tools` — tool design patterns (param self-lookup, single-job separation) that feed data into agent responses
- `agent-instruction-output-formatting` covered in Part 2 above
