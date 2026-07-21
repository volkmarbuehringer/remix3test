## Why

The workflow agent says "I have no tools for that" when asked simple user questions like "which users are locked". The admin users grid (`/admin/users`) already supports all needed filter modes (disabled, enabled, text search, sort, pagination). The agent has a `navigate` tool but never uses it for queries — only for workflow confirmation steps.

## What Changes

- Add user-query instructions to the workflow agent: for any general user question, navigate to `/admin/users` with appropriate `filter` query param
- Map natural language to filter params: `disabled`/`locked` → `filter=disabled`, `active`/`enabled` → `filter=enabled`, text searches → `filter=<text>`
- No `ask_user` after query-driven navigation (query mode is distinct from workflow mode)

## Capabilities

### New Capabilities
- `agent-query-navigation`: Workflow agent uses `navigate` tool to show the users grid for general user questions

### Modified Capabilities

None.

## Impact

- `app/actions/mastra/agents/workflow-agent.ts`: Add instruction section for user queries
