## 1. Asset Server Config

- [x] 1.1 Update `app/assets.ts` `allowFiles` to use `app/**/*.browser.*` + `app/assets/entry.tsx` + `app/routes.ts`
- [x] 1.2 Verify `denyFiles: ['app/**/*.server.*']` is unchanged and still active

## 2. Co-locate Admin Context Menus

- [x] 2.1 Rename `app/assets/admin-users-context-menu.tsx` → `app/ui/admin/admin-users-context-menu.browser.tsx`
- [x] 2.2 Rename `app/assets/admin-appointments-context-menu.tsx` → `app/ui/admin/admin-appointments-context-menu.browser.tsx`
- [x] 2.3 Rename `app/assets/admin-resources-context-menu.tsx` → `app/ui/admin/admin-resources-context-menu.browser.tsx`
- [x] 2.4 Rename `app/assets/admin-offerings-context-menu.tsx` → `app/ui/admin/admin-offerings-context-menu.browser.tsx`
- [x] 2.5 Rename `app/assets/admin-offering-configs-context-menu.tsx` → `app/ui/admin/admin-offering-configs-context-menu.browser.tsx`
- [x] 2.6 Rename `app/assets/admin-view-toggle.tsx` → `app/ui/admin/admin-view-toggle.browser.tsx`
- [x] 2.7 Rename `app/assets/admin-delete-past-button.tsx` → `app/ui/admin/admin-delete-past-button.browser.tsx`
- [x] 2.8 Rename `app/assets/persistent-admin-counter.tsx` → `app/ui/admin/persistent-admin-counter.browser.tsx`

## 3. Co-locate Nutzer (User) Components

- [x] 3.1 Rename `app/assets/nutzer-table-interactive.tsx` → `app/ui/nutzer/nutzer-table-interactive.browser.tsx`
- [x] 3.2 Move and rename `app/assets/client-grid-inline-edit.tsx` → `app/ui/nutzer/client-grid-inline-edit.browser.tsx`

## 4. Co-locate Lists Components

- [x] 4.1 Rename `app/assets/lists-client.tsx` → `app/actions/lists/lists-client.browser.tsx`
- [x] 4.2 Rename `app/assets/lists-search.tsx` → `app/actions/lists/lists-search.browser.tsx`
- [x] 4.3 Rename `app/assets/list-name-edit.tsx` → `app/actions/lists/list-name-edit.browser.tsx`

## 5. Co-locate Appointment Components

- [x] 5.1 Rename `app/assets/appointments-scroll-lock.tsx` → `app/ui/appointments-scroll-lock.browser.tsx`

## 6. Co-locate Stream/Agent Components

- [x] 6.1 Create `app/assets/streams/` directory
- [x] 6.2 Move `app/assets/customer-chat-stream.tsx` → `app/assets/streams/customer-chat-stream.browser.tsx`
- [x] 6.3 Move `app/assets/workflow-agent-stream.tsx` → `app/assets/streams/workflow-agent-stream.browser.tsx`
- [x] 6.4 Move `app/assets/support-agent-stream.tsx` → `app/assets/streams/support-agent-stream.browser.tsx`
- [x] 6.5 Move `app/assets/route-agent-stream.tsx` → `app/assets/streams/route-agent-stream.browser.tsx`
- [x] 6.6 Move `app/assets/test-agent-stream.tsx` → `app/assets/streams/test-agent-stream.browser.tsx`

## 7. Co-locate Shared UI Components

- [x] 7.1 Rename `app/assets/nav-toggle.tsx` → `app/ui/layout/nav-toggle.browser.tsx`
- [x] 7.2 Rename `app/assets/theme-toggle.tsx` → `app/ui/theme-toggle.browser.tsx`
- [x] 7.3 Rename `app/assets/confirm-delete.tsx` → `app/ui/confirm-delete.browser.tsx`
- [x] 7.4 Rename `app/assets/connection-indicator.tsx` → `app/ui/connection-indicator.browser.tsx`
- [x] 7.5 Rename `app/assets/grid-refresh-button.tsx` → `app/ui/grid-refresh-button.browser.tsx`
- [x] 7.6 Rename `app/assets/chatlog-row-detail.tsx` → `app/ui/chatlog-row-detail.browser.tsx`
- [x] 7.7 Rename `app/assets/webhook-composer.tsx` → `app/ui/webhook-composer.browser.tsx`
- [x] 7.8 Rename `app/assets/agent-prefill-store.ts` → `app/ui/agent-prefill-store.browser.ts`
- [x] 7.9 Rename `app/assets/password-complexity-script.tsx` → `app/ui/password-complexity-script.browser.tsx`
- [x] 7.10 Rename `app/assets/password-toggle.tsx` → `app/ui/password-toggle.browser.tsx`

## 8. Update All Imports

- [x] 8.1 Update imports in `app/actions/fragments/controller.tsx` (CartButton, CartItems from assets/ → ui/)
- [x] 8.2 Update imports in `app/actions/books/show-page.tsx` (ImageCarousel)
- [x] 8.3 Update imports in all admin controllers (context menus, view-toggle, delete-past, counter)
- [x] 8.4 Update imports in nutzer controllers
- [x] 8.5 Update imports in lists controllers
- [x] 8.6 Update imports in appointment controllers (scroll-lock)
- [x] 8.7 Update imports in all stream/agent page controllers
- [x] 8.8 Update imports in layout component (nav-toggle, theme-toggle)
- [x] 8.9 Search for any remaining `from 'app/assets/...'` imports and update

## 9. Clean Up

- [x] 9.1 Verify `app/assets/` contains only `entry.tsx`, `streams/`, and the test file
- [x] 9.2 Verify no `.server.` files exist in `app/assets/`
- [x] 9.3 Run `npm run typecheck` — passes cleanly
- [x] 9.4 Run `npm test` — 1004 pass, 2 pre-existing DB adapter failures unrelated to migration
