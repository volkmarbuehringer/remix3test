## Context

newapp now has `/chat` and `/agent` routes (from the previous port) that persist conversations in a `chatlog` table. It lacks admin oversight — there's no way to view, search, or delete conversations. The my_app project has a full admin section with a sidebar layout, dashboard cards, and a paginated chatlog browser with tool-call metadata display, built on Remix frames for client-side navigation within the admin section.

The admin routes need:
- Role-based access control (`user.role === 'admin'`)
- A frame-based architecture for in-page navigation (to avoid full page reloads when navigating between admin sections)
- A sidebar nav with icon-linked navigation groups
- Paginated, filterable conversation browsing with expandable message details

## Goals / Non-Goals

**Goals:**
- Port the `/admin` dashboard route with cards linking to admin sub-sections
- Port the `/admin/chatlog` route with pagination, filtering, delete, and message detail expansion
- Port the `requireAdmin` middleware for role-based admin access
- Create an admin layout with sticky sidebar navigation and frame-based content loading
- Create the `AdminActionButton` client-entry component for confirm-then-delete actions
- Adapt all admin UI to newapp's theme system

**Non-Goals:**
- No `/admin/lists` or `/admin/messages` routes (not requested)
- No changes to `package.json`
- No changes to existing auth, database, or middleware infrastructure (except adding `requireAdmin`)
- No changes to existing routes or functionality
- No full test suite for admin routes (follow-up change)

## Decisions

### 1. Admin route tree via separate `adminRoutes` export

**Decision**: Define admin routes in a separate `adminRoutes` export in `routes.ts` (matching the `authRoutes` and `aiRoutes` pattern from previous ports), with `admin` as the root and `chatlog` as a sub-route.

**Rationale**: Admin routes need their own controllers with admin-specific middleware. Keeping them in a separate export keeps the main `routes` object clean and allows individual `router.map()` calls with different controller + middleware configurations.

### 2. Frame-based admin sidebar navigation

**Decision**: Port the frame-based admin layout from my_app. The admin section uses `AdminShellOrFragment` which either renders the full admin shell (sidebar + content) for frame-targeted requests, or wraps a `<Frame>` inside the main `Layout` for initial navigation. Navigation links within the admin section use `rmx-target={adminContent}` to only reload the content frame.

**Rationale**: This provides a SPA-like experience within the admin section without full page reloads on every navigation. Remix's `resolveFrame` in `render.tsx` already supports this pattern.

### 3. Flat composite controllers (newapp style)

**Decision**: Create `app/actions/admin-controller.tsx` and `app/actions/admin-chatlog-controller.tsx` as flat files, following the same pattern as `chat-controller.tsx` and `agent-controller.tsx`.

**Rationale**: Consistent with newapp's established composite controller pattern.

### 4. Admin layout as page component in app/ui/

**Decision**: Place the admin layout (`AdminLayout`), dashboard page, and chatlog page in `app/ui/` as page components (`admin-layout.tsx`, `admin-page.tsx`, `admin-chatlog-page.tsx`). The `renderAdminPage` helper stays in the layout file.

**Rationale**: Follows newapp's architecture: "Page modules in app/ui/. Route-owned page components live in app/ui/, not app/actions/."

### 5. AdminActionButton as client-entry in app/actions/

**Decision**: Place the `AdminActionButton` client-entry component at `app/actions/admin-action-button.tsx` (matching its my_app location relative to controllers).

**Rationale**: It's an action-button tied to admin functionality, not a shared UI component. If it becomes reusable, it can be moved to `app/assets/` later.

### 6. requireAdmin middleware

**Decision**: Port `requireAdmin` middleware from my_app unchanged. It uses the existing `Auth` from `remix/auth-middleware` and checks `user.role === 'admin'`. Unauthenticated users are redirected to `/login`; non-admin authenticated users get a 403 HTML response.

**Rationale**: newapp already has `requireAuth` and the same `Auth` middleware. The admin middleware is a small, self-contained check that's a standard pattern for Remix 3 apps.

### 7. Nav visibility via existing `adminOnly` field

**Decision**: Add an Admin nav item to `app/ui/nav.ts` with `adminOnly: true`, and update the filtering logic in `app/ui/layout.tsx` to conditionally render admin-only nav items based on `user?.role === 'admin'`.

**Rationale**: The `NavItem` type already has an `adminOnly?: boolean` field designed for this purpose. The layout currently renders all items unconditionally — it just needs a filter. This keeps the nav registry declarative and avoids hard-coding role checks at render time.

### 8. Pagination and filtering inline (no query builder)

**Decision**: Port the pagination (offset/limit with `PAGE_SIZE = 5`) and filtering (`ILIKE` on conversation JSON) directly from my_app's `getAllConversations` chatlog function. No external pagination library.

**Rationale**: The chatlog library already exists from the previous port. The `getAllConversations` function with ILIKE filtering is already implemented — the admin just needs to call it.

## Risks / Trade-offs

- **[Risk] Frame navigation breaks without JS**: If JavaScript is disabled, `rmx-target` links will do full page navigations instead of frame updates. → Mitigation: This is acceptable — the admin still works, it's just less smooth.
- **[Risk] Admin user not seeded**: The seed data creates an admin user (`admin@newapp.com` / `admin123`). If the DB isn't seeded, no user can access admin routes. → Mitigation: The existing seed from the initial newapp setup already creates this admin user.
- **[Trade-off] Minimal admin scope**: Only dashboard and chatlog are ported. Lists admin and messages admin are not included. They can be added in future changes following the same pattern.
- **[Trade-off] No admin-specific tests**: Test coverage for admin routes is deferred. The existing patterns (controller tests with Remix test utils) can be applied in a follow-up.
