---
name: agent-guidance
description: "Use when writing agent instructions or ask_user/confirm UI — render confirm options as inline action buttons and specify exact output-format templates."
origin: consolidated
---

# Agent Interaction Guidance

**Consolidated from:** `agent-ask-user-action-buttons`, `agent-instruction-output-formatting`

Covers two aspects of guiding agent-user interaction:
1. Rendering `ask_user`/confirm options as inline action buttons instead of radio buttons
2. Specifying exact output format templates in agent instructions to prevent invented summaries

## Load Only The References You Need

| Task involves... | Start with |
| --- | --- |
| Rendering `ask_user`/confirm options or clicking a choice in an agent chat UI | `references/action-buttons.md` |
| Writing/reviewing agent instructions that relay tool data, or debugging an agent that invents generic summaries | `references/output-formatting.md` |

## Core Rules

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
- Output-format instruction templates — covered in Part 2 above.
