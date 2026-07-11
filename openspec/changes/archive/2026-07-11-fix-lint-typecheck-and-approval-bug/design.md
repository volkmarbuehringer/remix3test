## Context

The test agent route (`/testagent`) has a tool-approval mechanism that should require user approval before `read_test_file` executes. A bug in the `requireToolApproval` callback causes it to check `ctx.toolName === 'read_test_file'` but Mastra registers tools using the key name from the tools object (`readTestFile`), not the tool's `id` field. The comparison never matches, so the tool runs without approval.

Additionally, the project has 42 typecheck errors in `app/actions/mastra/tools/test-tools.test.ts` and 3 lint violations across 3 files.

## Goals / Non-Goals

**Goals:**
- Fix `requireToolApproval` to match the correct tool name so approvals trigger
- Fix all 42 typecheck errors in `test-tools.test.ts`
- Fix all lint violations (2 errors, 1 warning)
- Confirm no regressions with `npm run typecheck && npm run lint`

**Non-Goals:**
- No architectural changes to the approval flow (stream → approve → resume pattern stays)
- No changes to the UI or client-side code

## Decisions

1. **Tool name: use key name, not id** — The `requireToolApproval` callback will check `ctx.toolName === 'readTestFile'` matching the key in `testTools`, not the `id` field. Mastra's `formatTools` uses the key as the LLM-facing tool name; the `id` is an internal identifier.

2. **Typecheck fixes: cast execute** — The `createTool` signature has `execute?: ToolAction['execute']`. In tests, we'll cast `testTools.listTestFiles` and `testTools.readTestFile` via `as ToolAction<...>` to get a typed `execute` with the correct 2-argument signature and return type.

3. **Lint fixes: mechanical** — `'x-forwarded-for'` → `'X-Forwarded-For'`, `let store = new Map` → `const store = new Map`, `let projectRoot = realpathSync(...)` → `const projectRoot = realpathSync(...)`.

## Risks / Trade-offs

- **Mastra tool naming could change** — If a future Mastra version starts using `tool.id` as the provider-facing name (or strips the key), the fix breaks. Mitigation: we could add a comment referencing the `formatTools` behavior so the next reader knows why `readTestFile` is used.
