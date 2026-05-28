## Why

The `form()` route helper exists in `remix/routes` but is only used for auth routes. Three AI sub-routes (chat, agent, workflow) manually repeat the same `route('...', { index: get('/'), action: post('/') })` pattern that `form()` is designed to replace. Using `form()` reduces boilerplate, makes the route definitions more declarative, and establishes a consistent convention across the codebase.

## What Changes

- Replace `route('chat', { index: get('/'), action: post('/') })` with `form('chat')` in `aiRoutes`
- Replace `route('agent', { index: get('/'), action: post('/') })` with `form('agent')` in `aiRoutes`
- Replace `route('workflow', { index: get('/'), action: post('/') })` with `form('workflow')` in `aiRoutes`
- No import changes needed — `form` is already imported from `remix/routes`
- No controller, router, or UI changes needed — `form()` generates identical route names (`index`, `action`)

## Capabilities

### New Capabilities

This change introduces no new capabilities. It is a pure refactoring of route definitions — the behavior, route structure, and API surface remain identical.

### Modified Capabilities

None. No spec-level requirements are changing.

## Impact

- **Affected code**: `app/routes.ts` only — three route definitions simplified
- **No API changes**: The public route names (`aiRoutes.ai.chat.index`, `aiRoutes.ai.chat.action`, etc.) remain identical
- **No controller changes**: All controllers continue to work without modification
- **No UI changes**: Form actions referencing `aiRoutes.ai.chat.action.href()` etc. work identically
- **No test changes**: Route behavior is unchanged
