## Why

`AdminActionButton` is a per-row `clientEntry` component used in 3 admin pages (lists, messages, chatlog) inside `frames.adminContent`. Same Frame scheduler cascade risk as the client grid — any admin page with 50+ rows will hit `MAX_CASCADING_UPDATES=50`. These buttons don't need per-row JS: they're inside existing `<form>` elements that already have `<CsrfTokenInput />`.

## What Changes

- **Convert `AdminActionButton` from `clientEntry` to plain submit button** — use `<button type="submit" data-confirm="...">` with the existing form
- **Add `rmx-target={frames.adminContent}`** to the enclosing forms for Frame-aware navigation
- **Adjust destroy actions** in admin controllers to redirect to the admin content index route (fragment URL)
- **Remove `app/assets/admin-action-button.tsx`**

## Capabilities

### New Capabilities
- `server-render-admin-action-button`: Replace per-row clientEntry action buttons in admin pages with server-rendered submit buttons

### Modified Capabilities


## Impact

- `app/assets/admin-action-button.tsx` — delete
- `app/ui/admin-lists-page.tsx` — inline submit button, add `rmx-target` to form
- `app/ui/admin-messages-page.tsx` — inline submit button, add `rmx-target` to form
- `app/ui/admin-chatlog-page.tsx` — inline submit button, add `rmx-target` to form
- `app/actions/admin/lists/controller.tsx` — destroy redirect target
- `app/actions/admin/messages/controller.tsx` — destroy redirect target
- `app/actions/admin/controller.tsx` (chatlog destroy) — redirect target
