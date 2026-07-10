## Why

newapp needs an admin section to manage chat/agent conversations. The my_app project already has a working admin dashboard and chat log viewer with pagination, filtering, and tool-call-aware metadata display. Porting these routes gives newapp administrative oversight of its AI features without rebuilding from scratch.

## What Changes

- Add `/admin` route with a dashboard page containing cards that link to admin sub-sections
- Add `/admin/chatlog` route with a paginated, filterable conversation viewer
- Add `/admin/chatlog/:id/delete` POST endpoint to delete conversations
- Create `requireAdmin` middleware for role-based access control (admin role check)
- Create admin layout with sidebar navigation (sticky, with icon-linked nav groups)
- Create `AdminActionButton` client-entry component for inline confirm-then-delete actions
- Wire admin routes into newapp's router with `aiRoutes` pattern

**No changes to**:

- `package.json` (dependencies already installed)
- Existing routes, auth, database, or middleware infrastructure

## Capabilities

### New Capabilities

- `admin-dashboard`: Admin landing page at `/admin` with cards linking to chatlog, lists, and other management sections
- `admin-chatlog-browser`: Paginated conversation viewer at `/admin/chatlog` with full-text search filter, message detail expansion, and tool call metadata display
- `admin-auth-middleware`: Role-based admin access control middleware that checks `user.role === 'admin'` and returns 403 for non-admin users
- `admin-action-button`: Client-entry component for inline admin actions (delete, etc.) with confirmation dialog and loading state

### Modified Capabilities

- (none — no existing specs to modify)

## Impact

**New files** (ported from my_app, adapted to newapp conventions):

- `app/middleware/admin.ts` — Admin authorization middleware (requireAdmin)
- `app/actions/admin-controller.tsx` — Admin dashboard controller
- `app/actions/admin-chatlog-controller.tsx` — Chatlog browser controller
- `app/actions/admin-action-button.tsx` — Client-entry confirm-then-action button
- `app/ui/admin-page.tsx` — Admin dashboard page component
- `app/ui/admin-layout.tsx` — Admin sidebar + content layout shell
- `app/ui/admin-chatlog-page.tsx` — Chatlog browser page component

**Modified files**:

- `app/routes.ts` — Add `admin` and `admin.chatlog` route definitions under an `adminRoutes` export
- `app/router.ts` — Wire admin and admin-chatlog controllers

**Dependencies**: Already present in newapp's package.json (no additions needed).
