## 1. Convert 9 single-export controllers to `export default`

- [x] 1.1 `app/actions/test-agent/controller.tsx` — change `export const testAgent` to `export default`
- [x] 1.2 `app/actions/route-agent/controller.tsx` — change `export const routeAgent` to `export default`
- [x] 1.3 `app/actions/agent-events/controller.tsx` — change `export const agentEvents` to `export default`
- [x] 1.4 `app/actions/webhook/controller.tsx` — change `export const webhookReceive` to `export default`
- [x] 1.5 `app/actions/api/login/controller.tsx` — change `export const apiLogin` to `export default`
- [x] 1.6 `app/actions/api/logout/controller.tsx` — change `export const apiLogout` to `export default`
- [x] 1.7 `app/actions/app-webhook/controller.tsx` — change `export const appWebhookReceive` to `export default`
- [x] 1.8 `app/actions/webhook-requests/create/controller.tsx` — change `export const webhookRequestsCreate` to `export default`
- [x] 1.9 `app/actions/callback/controller.tsx` — change `export const callbackReceive` to `export default`
- [x] 1.10 Run `pnpm run typecheck` to verify no breakage

## 2. Create verwaltung barrel

- [x] 2.1 Create `app/actions/verwaltung/index.ts` re-exporting all 8 sub-controllers
- [x] 2.2 Update `app/router.ts` to `import * as verwaltung from './actions/verwaltung/index.ts'`
- [x] 2.3 Update all `router.map(routes.verwaltung.X, ...)` calls to use `verwaltung.X`
- [x] 2.4 Run `pnpm run typecheck` to verify

## 3. Switch admin barrel to namespace import

- [x] 3.1 Update `app/router.ts`: replace destructured admin import with `import * as admin`
- [x] 3.2 Update all `router.map(routes.admin.X, ...)` calls to use `admin.X`
- [x] 3.3 Run `pnpm run typecheck` to verify

## 4. Update router.ts import lines for the 9 converted controllers

- [x] 4.1 Change all 9 named imports (`import { x } from`) to default imports (`import x from`)
- [x] 4.2 Run `pnpm run typecheck` to verify

## 5. Final verification

- [x] 5.1 Run full typecheck (`pnpm run typecheck`)
- [x] 5.2 Run test suite (`pnpm test` — requires local PG; typecheck passes, DB-independent tests pass)
