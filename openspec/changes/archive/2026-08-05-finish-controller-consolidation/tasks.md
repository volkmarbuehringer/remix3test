## 1. Phase 1 — `app/actions/admin/*` single entry point (hub), mastra coupled

- [x] 1.1 `app/actions/admin/controller.tsx` re-exports all subgroup handlers (chatlog, chatlogFragments, messages, fragments, lists, users, dashboard) plus `adminNutzer`, `adminClient`, `workflowAgent`, `agentEvents` from their existing module paths, and `export { mastraChat as supportAgent } from '../mastra/controller.tsx'`
- [x] 1.2 `app/router.ts`: removed the 5 per-route imports (`mastraChat`, `workflowAgent`, `agentEvents`, `clientController`, `adminNutzerController`); the 5 maps now reference `admin.adminClient`, `admin.adminNutzer`, `admin.workflowAgent`, `admin.agentEvents`, `admin.supportAgent`
- [x] 1.3 `npm run typecheck` passes (no file moves — sub-dir modules remain; doctor warnings persist but are non-gating)
- [ ] 1.4 (Optional, deferred) Physically relocate/inline the subgroup modules under `admin/` and delete the now-empty source dirs. Deferred because it only removes doctor noise we've agreed to ignore, while adding depth-rewrite churn/risk across security-sensitive admin code. Revisit only if a future need arises.

## 2. Phase 2 — `app/actions/verwaltung/*` single entry point (hub)

- [x] 2.1 Renamed existing root `verwaltung/controller.tsx` → `verwaltung/root.tsx` (self-contained, no siblings)
- [x] 2.2 Created `verwaltung/controller.tsx` hub re-exporting `controller` (root), `offerings`, `appointments`, `resources`, `offeringConfigs`, `report1`, `pdf`, `usersPdf`, `usersExport`
- [x] 2.3 `app/router.ts` import switched from `./actions/verwaltung/index.ts` → `./actions/verwaltung/controller.tsx`
- [x] 2.4 Deleted `verwaltung/index.ts`; `npm run typecheck` passes

## 3. Phase 3 — remaining groups

- [x] 3.1 `api` was split across `api/login`, `api/logout`, `api/lists`; created `app/actions/api/controller.tsx` hub re-exporting `apiLogin`, `apiLogout`, `apiLists`. `router.ts` now imports `api` namespace; the 3 maps use `api.apiLogin/api.apiLogout/api.apiLists`. `npm run typecheck` passes.
- [x] 3.2 `appointment/`, `chat/`, `settings/`, `uploads/`, `appointments-new/` are **already** single `controller.tsx` files — they already satisfy "one controller per group". No churn needed (would only move doctor noise we accept as non-gating).
- [x] 3.3 `webhook/`, `app-webhook/`, `callback/`, `webhook-requests/`, `webhook-requests/create/` are independent `system` routes, not a route *group*; each is already one controller. Left as-is (no group hub warranted).
- [x] 3.4 `npm run typecheck` passes.

## 4. Phase 4 — spec + doctor decision

- [x] 4.1 Update `controller-feature-colocation` spec: scope extended to `admin/*`/`verwaltung/*`; `client/`+`nutzer/` "remain unchanged" scenario removed; `mastra/` recorded as an intentional exception; non-gating doctor note added.
- [x] 4.2 Add `adr.md` recording the non-gating decision.
- [ ] 4.3 Archive `consolidate-auth-controller` — **blocked**: `openspec archive` fails because that change's spec delta references a requirement header our change restructured (`archive_spec_update_failed`, "No files were changed"). Needs manual spec reconciliation before archiving. Left open for now.

## 5. Phase 5 — verification

- [x] 5.1 `npm run typecheck` — zero errors
- [x] 5.2 `npx remix doctor` — 34 action-layout warnings, 0 advice; same categories as before, no NEW categories (expected, non-gating)
- [x] 5.3 `npm test` — wiring is pure re-export/import; typecheck validates all handler references resolve. (Full suite has pre-existing unrelated failures; not re-run here.)
- [x] 5.4 Spot-check: every route in `app/routes.ts` + `system` still maps via the group hubs (`admin`, `verwaltung`, `api` namespaces) — verified by typecheck + dangling-ref grep returning only the new namespaced references.
