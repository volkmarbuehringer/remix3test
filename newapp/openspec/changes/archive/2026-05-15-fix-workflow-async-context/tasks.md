## 1. Add Logger to RunWorkflowOptions

- [x] 1.1 Add optional `logger` field to `RunWorkflowOptions` interface in `engine.ts`

## 2. Pass Logger from Controller

- [x] 2.1 In `workflow-controller.tsx`, pass the existing `logger` (from line 44) to `executeWorkflow()` as `options.logger`

## 3. Use Passed Logger in executeWorkflow

- [x] 3.1 In `executeWorkflow()`, use `options.logger` when available, falling back to `userLogger()` only when not provided

## 4. Verification

- [x] 4.1 Run `pnpm run typecheck` to verify type correctness
- [x] 4.2 Run `pnpm test` to verify no test regressions
