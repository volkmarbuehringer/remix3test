# Tasks: Colocate Browser Source in `public/`

## 1. Route-owned browser files → `<route>/public/`

- [x] 1.1 `git mv` `app/actions/lists/*.browser.{ts,tsx}` → `app/actions/lists/public/` (drop-zone, list-name-edit, lists-client, lists-search, lists-sidebar-keyboard), dropping `.browser.` suffix
- [x] 1.2 `git mv` `app/ui/admin/*.browser.tsx` → `app/actions/admin/public/` (admin-users-context-menu, admin-appointments-context-menu, admin-resources-context-menu, admin-offerings-context-menu, admin-offering-configs-context-menu, admin-view-toggle, admin-delete-past-button, persistent-admin-counter), dropping `.browser.` suffix
- [x] 1.3 `git mv` `app/ui/nutzer/*.browser.tsx` → `app/actions/nutzer/public/` (nutzer-table-interactive, client-grid-inline-edit), dropping `.browser.` suffix
- [ ] 1.4 `git mv` `app/ui/appointment-*.browser.tsx` + `app/ui/appointtype-panel.browser.tsx` + `app/ui/appointments-scroll-lock.browser.tsx` → `app/actions/appointment/public/`, dropping `.browser.` suffix — **SKIPPED**: appointment-grid/sidebar/appointtype-panel/scroll-lock depend on a shared `app/ui/` helper cluster (schedule-layout, appointment-grid-lib/types/styles, toast, mixins/icon) also consumed by `app/ui` tests and pages; they remain in `app/ui/` as a shared subsystem. See design.md.
- [x] 1.5 `git mv` `app/ui/chatlog-row-detail.browser.tsx` → `app/actions/admin/chatlog/public/`, dropping `.browser.` suffix
- [x] 1.6 `git mv` `app/ui/webhook-composer.browser.tsx` → `app/actions/webhook-requests/public/`, dropping `.browser.` suffix
- [x] 1.7 `git mv` `app/ui/grid-refresh-button.browser.tsx` → `app/actions/client/public/`, dropping `.browser.` suffix

## 2. Stream components → `app/assets/streams/public/`

- [x] 2.1 `git mv` `app/assets/streams/*.browser.tsx` → `app/assets/streams/public/` (customer-chat-stream, workflow-agent-stream, route-agent-stream, agent-events-stream, support-agent-stream, test-agent-stream), dropping `.browser.` suffix

## 3. Update imports

- [x] 3.1 Rewrite route-owned imports: `../../ui/<name>.browser.tsx` → `./public/<name>.tsx` in owning server modules (client/grid-page.tsx, nutzer, admin pages, lists, chatlog, webhook-requests); fix internal relative imports of moved files to point back at `app/ui/` helpers (theme, toast, utils, routes)
- [x] 3.2 Update stream imports in `app/ui/*-page.tsx` from `../../assets/streams/<name>.browser.tsx` to `../../assets/streams/public/<name>.tsx`
- [x] 3.3 Verify no stale `.browser.` references remain for moved files: `grep -rn "public/\|\.browser\." app/`

## 4. Asset allow-list

- [x] 4.1 Rewrite `allowFiles` in `app/assets.ts`: add `app/**/public/**` for route-owned/stream source; keep `app/ui/**` broad (moved browser components depend on shared `ui/` helpers like `theme`, `auto-grow-textarea` that are not `.browser.*`); keep explicit `assets/` entry plumbing, `app/routes.ts`, `app/utils/**`. (Note: the originally-proposed `app/ui/**/*.browser.*` glob would block those shared helpers — see design.md.)

## 5. Tests and verification

- [x] 5.1 Update `app/assets/frame-response.test.browser.ts` and any `getPreloads`/`getHref` calls referencing moved paths
- [x] 5.2 Run `npm run typecheck` and fix any import errors
- [x] 5.3 Run `npm test` — 1088/1090 server tests pass; the 2 failures are the headless browser-test project failing to connect (`ERR_CONNECTION_REFUSED` on its harness server), an environment issue unrelated to these moves. Server tests exercising the moved files (resolveDropZone, AppointmentsScrollLock) pass. Note: `render.test.tsx` is not matched by the `**/*.test{,.browser,.e2e}.ts` glob (it's `.tsx`), so it doesn't run in CI regardless of this change.
- [x] 5.4 Smoke-test a frame-rendered route (e.g. client grid) to confirm browser assets load — verified `assetServer.getHref` resolves moved `public/` files, shared `ui/` browser files, shared `ui/` helper modules (theme, auto-grow-textarea), and entry plumbing; frame-rendering server tests pass.
