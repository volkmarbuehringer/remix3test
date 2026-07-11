## Why

The project has 42 typecheck errors in `test-tools.test.ts`, 2 lint errors and 1 warning across the test-agent route, and a bug where the `read_test_file` tool approval never triggers because the `requireToolApproval` callback checks against the tool's `id` instead of the key name Mastra registers with the LLM.

## What Changes

1. **Fix typecheck errors in `test-tools.test.ts`** — Cast `execute` to the correct type, fix the arity (needs 2 args), and properly type the results.
2. **Fix lint errors** — Use canonical header name `'X-Forwarded-For'`, change `let` to `const` for module-scoped bindings that are never reassigned.
3. **Fix the approval bug** — Change `requireToolApproval: (ctx) => ctx.toolName === 'read_test_file'` to match the actual tool name `readTestFile` that Mastra registers with the LLM provider.

## Capabilities

### New Capabilities

- `test-agent-tool-approval`: Correct tool-approval gating for the test agent's `read_test_file` tool, so the user is prompted to approve file reads before they execute.

### Modified Capabilities

None.

## Impact

- `app/actions/test-agent/controller.tsx` — fix `requireToolApproval` callback and lint
- `app/actions/mastra/tools/test-tools.test.ts` — fix type errors
- `app/utils/stream-store.ts` — fix lint
- `app/actions/mastra/tools/test-tools.ts` — fix lint
