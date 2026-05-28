<!-- Context: workflows/external-context-integration | Priority: high | Version: 1.1 | Updated: 2026-04-02 -->

# External Context Integration Guide

**Purpose**: How to integrate external docs (fetched via ExternalScout) into main agent workflow so subagents can access without re-fetching.

## Key Points

- Main agent fetches external docs once → persists to `.tmp/external-context/` → references in session → subagents read (no re-fetching)
- Always call ExternalScout early in planning phase when external libraries involved
- Add external context files to session context under "## External Context Fetched"
- Pass session path to subagents so they know where to find external docs

## Minimal Example

```javascript
// Main agent: Fetch external docs
task(subagent_type="ExternalScout", prompt="Fetch docs for drizzle-orm, better-auth")

// Main agent: Add to session context
// .tmp/sessions/{session-id}/context.md:
// ## External Context Fetched
// - .tmp/external-context/drizzle-orm/modular-schemas.md
// - .tmp/external-context/better-auth/nextjs-integration.md

// Main agent: Delegate with session path
task(subagent_type="TaskManager", prompt="Load context from .tmp/sessions/{id}/context.md")
```

## Workflow

1. Detect external libraries in user request
2. Call ExternalScout to fetch live docs
3. Add to session context under "External Context Fetched"
4. Pass session path to subagents
5. Subagents read persisted files (no re-fetch)

**Reference**: Full guide at `.opencode/context/core/workflows/guides/external-context-integration.md`

**Related**: `external-context-management.md`, `task-delegation-basics.md`