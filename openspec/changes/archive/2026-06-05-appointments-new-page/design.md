## Context

The existing `/verwaltung/appointments` page is an admin-only CRUD grid with full columns (email, created_at, updated_at), right-click context menu, user selection in form, and admin-specific audit log/rate limiting. A simplified self-service version is needed for all authenticated users to manage their own appointments without the admin overhead.

## Goals / Non-Goals

**Goals:**
- New route at `/appointments/new` (top-level) accessible to any authenticated user via `requireAuth()` middleware
- Table view showing only relevant columns: ID, Titel, Ressource, Datum, Zeit
- Inline action buttons (Bearbeiten/Löschen) per row instead of right-click context menu
- Create/edit form without user_id field — user is always the currently authenticated user
- Preserved grid state (sort, filter, period, pagination) across interactions
- Reuse existing data layer, validation schema, SSE channel, and CSS mixins from the admin version
- Foundation for future responsive mobile design

**Non-Goals:**
- No changes to the existing `/verwaltung/appointments` admin page
- No rate limiting (normal user operations assumed low volume)
- No audit logging (not admin operations)
- No 24h cancellation policy for non-admin users
- No changes to DB schema or shared data functions

## Decisions

### 1. Route location: `/appointments/new` (top-level)
Moving outside `/verwaltung/` makes the route accessible to non-admin users without modifying the admin middleware chain. Matches the pattern of the public `/appointment` route which is also top-level.

### 2. Middleware: `requireAuth()` only, no `requireAdmin()`
The existing controller uses both middleware. The new controller drops `requireAdmin()` so any authenticated user can access their own appointments.

### 3. New controller, not shared controller
A separate controller (`actions/appointments-new/controller.tsx`) avoids mixing admin and user logic in a single file. The alternative (composing shared CRUD functions) was rejected because the controller contains significant cross-cutting concerns (loading page data, validation, error handling) that differ between admin and user views.

### 4. Action buttons instead of context menu
Each row gets explicit action buttons (edit/delete) rendered server-side. This works on mobile without JavaScript, is more discoverable, and eliminates the `clientEntry` asset dependency. The existing context menu asset remains for the admin page.

### 5. No user_id in form, no user options loading
The form always uses `context.auth.identity.id` as the user_id. This removes the need to:
- Query and cache the `users` table for the dropdown
- Validate user_id in the schema
- Include user_id in form fields

### 6. Simplified schema without user_id
A new schema variant `appointmentsNewSaveSchema` in `utils/appointment-schema.ts` omits `user_id`. The alternative (making user_id optional in the existing schema) adds risk of accidentally bypassing validation in the admin form.

### 7. Shared data layer reused as-is
`appointments.ts` CRUD functions accept user_id as a parameter, so the new controller passes `auth.identity.id` directly. No changes needed.

## Risks / Trade-offs

- **Duplicate controller code** — The new controller is ~50% similar to the admin version. A shared base class or composition layer was considered but rejected to keep each controller independently maintainable. Future refactoring could extract shared helpers.
- **SSE channel collision** — Both pages subscribe to the same `appointmentChannel`. This is fine because both admin and user views show the same appointments data and both benefit from real-time invalidation.
- **Database column `user_id` still exists** — The simplified view omits the user column, but appointments still have a `user_id` in the DB. The new controller always queries with `WHERE a.user_id = $1` filtered to the current user.
- **Mobile readiness** — The action button approach is inherently more mobile-friendly than context menu, but responsive breakpoints and stacked layouts are deferred to a follow-up change.
