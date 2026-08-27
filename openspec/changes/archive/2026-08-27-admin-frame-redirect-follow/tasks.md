## 1. Scope the middleware to admin frame targets

- [x] 1.1 Add an `ADMIN_FRAME_TARGETS` set in `app/middleware/frame-redirect.ts`, derived from the `frames` constants in `app/routes.ts` (`admin-content`, `lists-content`, `workflow-agent-panel`, `agent-events-panel`, `support-agent-panel`). Verify with `npm run typecheck`. (Design D1) — `npm run typecheck` passes.
- [x] 1.2 Gate `frameRedirects()` so it only follows in-frame when `X-Remix-Target` is in `ADMIN_FRAME_TARGETS`; non-admin, cross-origin, and depth-limit cases return the redirect unchanged. Verify by extending `app/middleware/frame-redirect.test.ts` with a non-admin-target case and running `npm test`. — `frame-redirect.test` 6/6 pass.

## 2. Wire the middleware into the router

- [x] 2.1 Add `frameRedirects()` to `createNewappMiddleware` in `app/middleware/root.ts`, positioned so it observes the controller's final response and has `context.router.fetch` available (confirm placement against `app/test-router.ts`). Verify with `npm run typecheck` and that the existing server grid tests still pass (they do not send frame headers). (Design D2) — typecheck passes; `admin-users` 34/34 and `appointments-index` 14/14 pass.

## 3. Regression tests

- [x] 3.1 Add a router-level regression in `app/actions/admin/admin-users.test.ts`: POST `/admin/users/:id/toggle-disabled` with `X-Remix-Frame: true` + `X-Remix-Target: agent-events-panel`; assert a `200` fragment containing `data-rmx-target="agent-events-panel"` (the middleware followed the redirect in-frame, not a bare `302`). Verify with `npm test`. (Design D4) — `admin-users` 35/35 pass.
- [x] 3.2 Add an opportunistic Playwright e2e (gated on the Mastra classifier being available): load `/admin/agent-events`, send "cancel john doe", activate/deactivate a user, then assert the agent input/status bar are still present and the grid rendered inside the panel frame. Verify with `npx playwright test`. (Design D4) — authored as CI-only in `app/actions/agent-events/agent-events-frame-redirect.test.e2e.ts` (deterministic via `__setAgent`/`__setRunFactory` stubs; typecheck passes). **Executed locally** — drives the confirm-gate → resume → workflow-finish reload and passes; no 404.
- [x] 3.3 Reconcile the frame source after an in-frame followed redirect: `frameRedirects` sets `X-Remix-Redirect-To` (Design D5) and `entry.tsx` sets the target frame's `src` to it, so a later frame reload (workflow-finish) does not GET the POST action URL → 404. Verify with the router-level header assertion (`admin-users.test` 35/35) and the e2e (no 404 after resume).

## 4. Spec reconciliation

- [x] 4.1 After implementation, sync the amended `frame-navigation-conventions` (and the new `admin-frame-redirect-follow`) into the main spec and confirm `openspec validate` passes. — handled via archive (updates main specs); `openspec validate admin-frame-redirect-follow` is valid.
