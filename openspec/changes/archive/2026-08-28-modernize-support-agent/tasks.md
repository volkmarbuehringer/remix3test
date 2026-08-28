## 1. Relocate the controller

- [x] 1.1 Create `app/actions/support-agent/controller.tsx` as a wholesale copy of `app/actions/mastra/controller.tsx`, changing only the mastra-local imports (`./index.ts` → `../mastra/index.ts`, `./tools/admin-context.ts` → `../mastra/tools/admin-context.ts`, `./shared-agent.ts` → `../mastra/shared-agent.ts`). Verify it still exports the same `createController(routes.admin.supportAgent, …)` with the `index`/`panel`/`action`/`toolDecision`/`answer` actions and still re-exports `chatRateLimiter` and `__setTestAgent`. Verification: `npm run typecheck` passes and `git diff` on the new file against the source shows only the import-path lines changed.
- [x] 1.2 Confirm no behavioral edits were introduced during the move (event payloads, SSE framing, rate limiter, timeout, audit logging, approval/decline logic all identical). Verification: `git diff app/actions/mastra/controller.tsx app/actions/support-agent/controller.tsx` shows only `import` line differences.

## 2. Relocate the test

- [x] 2.1 Create `app/actions/support-agent/controller.test.ts` as a wholesale copy of `app/actions/mastra/controller.test.ts`, adjusting the mastra-local imports (`./index.ts` → `../mastra/index.ts`, `./tools/support-tools.ts` → `../mastra/tools/support-tools.ts`, `./tools/admin-context.ts` → `../mastra/tools/admin-context.ts`, `./shared-agent.ts` → `../mastra/shared-agent.ts`). The colocated `./controller.tsx` import and the `../../*` imports (db, test-pool, test-utils, routes, utils/mastra-memory, test-router) stay unchanged. Verification: `npm run typecheck` passes and the file's imports resolve.

## 3. Rewire and clean up

- [x] 3.1 Update `app/actions/admin/controller.tsx` to re-export the handler from `'../support-agent/controller.tsx'` instead of `'./support-agent/controller.tsx'`, matching the `workflow-agent` / `agent-events` wiring. Verification: `app/router.ts` still maps `routes.admin.supportAgent` to `admin.supportAgent` with no import change needed.
- [x] 3.2 Delete the one-line shell `app/actions/admin/support-agent/controller.tsx`. Verification: `grep -rn "admin/support-agent/controller" app` returns nothing.
- [x] 3.3 Delete `app/actions/mastra/controller.tsx` and `app/actions/mastra/controller.test.ts`. Verification: `grep -rn "mastra/controller" app` and `grep -rn "admin/support-agent/controller" app` return nothing, and `ls app/actions/mastra` still contains the agent subsystem (agents, tools, workflows, scorers, `index.ts`, `shared-agent.ts`, `storage.ts`, `workflow-executor.ts`, notifications) but no `controller.tsx`/`controller.test.ts`. Note: the internal handler export `mastraChat` is intentionally retained (design decision 4) inside the colocated controller.

## 4. Verify parity

- [x] 4.1 Run the relocated support-agent test suite (the former `mastra/controller.test.ts`), covering the `index`/`action` routes (auth guard, 403, message validation, rate limiting, SSE framing, threadId pass-through, routeNavigate) plus the added `toolDecision`/`answer` approval-flow tests (approve question suspension, decline message, missing-runId/invalid-decision 400s, answer resume + multi-select array), and the support tools. Verification: tests pass (`npm test`).
- [x] 4.2 Run typecheck and format/lint; resolve any formatting drift. Verification: `npm run typecheck` and `npm run format:fix` are clean.
- [x] 4.3 Final parity check — no client/UI impact and no route change. Verify `app/assets/streams/public/support-agent-stream.tsx`, `app/ui/support-agent-page.tsx`, and `app/router.ts` are untouched, and `routes.admin.supportAgent` still resolves. Verification: `git status` shows only the controller/test move plus the `admin/controller.tsx` re-export line.
