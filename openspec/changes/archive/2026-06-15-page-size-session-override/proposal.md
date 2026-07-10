## Why

Page sizes are hardcoded per controller (15, 20, 10, etc.). Users have no way to see more or fewer items per page without changing code. A session-based override on the settings page lets users temporarily choose how many rows they see, without persisting to the database — the change reverts on logout.

## What Changes

- Add a page size dropdown to the settings page under a new "Anzeige" panel
- Store the selected page size in the session as `session.set('pageSize', N)`
- In each paginated controller, read `session.get('pageSize')` and use it as an override before falling back to the hardcoded constant
- The override applies to all paginated lists in the app (admin users, messages, lists, chatlog, client grid, nutzer, appointments, offerings, resources, report1, offering configs)
- Session expiry or logout clears the override, reverting to defaults

## Capabilities

### New Capabilities

- `page-size-preference`: A user-facing page size selector in the settings page that stores the preference in the session as a temporary override over the hardcoded defaults.

## Impact

- `app/actions/settings/controller.tsx` — add page size form, new action case
- `app/actions/admin/users/controller.tsx` — read session for page size override
- `app/actions/admin/messages/controller.tsx` — read session for page size override
- `app/actions/admin/lists/controller.tsx` — read session for page size override
- `app/actions/admin/chatlog/controller.tsx` — read session for page size override
- `app/actions/client/controller.tsx` — read session for page size override
- `app/actions/nutzer/controller.tsx` — read session for page size override
- `app/actions/appointments-new/controller.tsx` — read session for page size override
- `app/actions/verwaltung/appointments/controller.tsx` — read session for page size override
- `app/actions/verwaltung/offerings/controller.tsx` — read session for page size override
- `app/actions/verwaltung/offering-configs/controller.tsx` — read session for page size override
- `app/actions/verwaltung/resources/controller.tsx` — read session for page size override
- `app/actions/verwaltung/report1/controller.tsx` — read session for page size override
- No new dependencies, no schema changes
