---
name: agent-instruction-output-formatting
description: "LLM agents ignore vague reporting instructions — specify exact output format templates in the prompt"
user-invocable: false
origin: auto-extracted
---

# Agent Instructions Need Explicit Output Formatting

**Extracted:** 2026-07-21
**Context:** A Mastra workflow agent was told "Report the results" after a consistency check tool ran. Instead of presenting the actual user names and pending appointment counts from the tool output, the agent invented a generic German "alles in Ordnung" (everything's fine) message — silently discarding the data.

## Problem

When an LLM agent's instructions say "Report the results" or "Present the findings" without specifying the exact format, the agent often:

- Summarizes generically ("No issues found", "All good") even when the tool returned specific data
- Omits individual items and only reports aggregate counts
- Invents plausible-sounding but factually incorrect summaries
- Places tool output data in the wrong conversational context

This is a failure of **instruction underspecificity** — the LLM optimizes for brevity/fluency over data fidelity when not explicitly constrained.

## Solution

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

## When to Use

- Writing or reviewing agent instructions for any LLM framework (Mastra, LangChain, OpenAI Assistants, custom)
- An agent consistently returns vague summaries instead of specific data from tool results
- Debugging "the tool returns correct data but the agent says something different"
