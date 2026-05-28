## 1. Admin Middleware

- [x] 1.1 Create `app/middleware/admin.ts` — `requireAdmin()` middleware (ported from my_app), checks auth + admin role, redirects unauthenticated, returns 403 for non-admin

## 2. Routes

- [x] 2.1 Add `adminRoutes` export to `app/routes.ts` with `/admin` (index) and `/admin/chatlog` (index + destroy) route definitions

## 3. Admin Layout

- [x] 3.1 Create `app/ui/admin-layout.tsx` — admin layout with sidebar navigation, `renderAdminPage` helper, `AdminLayout` component with nav groups, icon helpers, and frame-aware shell

## 4. Admin Dashboard

- [x] 4.1 Create `app/ui/admin-page.tsx` — dashboard page with cards linking to admin sub-sections
- [x] 4.2 Create `app/actions/admin-controller.tsx` — admin dashboard controller with requireAuth + requireAdmin middleware

## 5. Admin Chatlog Browser

- [x] 5.1 Add `getAllConversations` export to `app/lib/chatlog.ts` — paginated fetch with optional ILIKE text filter
- [x] 5.2 Create `app/ui/admin-chatlog-page.tsx` — chatlog browser page with pagination, filter, expandable messages, tool call display, delete form
- [x] 5.3 Create `app/actions/admin-chatlog-controller.tsx` — chatlog controller with index (pagination, filtering) and destroy (delete conversation) actions
- [x] 5.4 Create `app/actions/admin-action-button.tsx` — client-entry component for confirm-then-delete with loading state

## 6. Router Wiring

- [x] 6.1 Wire admin and admin-chatlog controllers in `app/router.ts`
- [x] 6.2 Add Admin nav link to `app/ui/nav.ts` with `adminOnly: true`
- [x] 6.3 Update `app/ui/layout.tsx` to filter nav items by `adminOnly` flag against user role

## 7. Verify

- [x] 7.1 Run `pnpm run typecheck` to verify no type errors
- [x] 7.2 Run `pnpm run lint` to verify no lint issues
- [x] 7.3 Run `pnpm test` to verify existing tests still pass
