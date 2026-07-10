## Context

`AdminActionButton` is a `clientEntry` component used per-row in 3 admin pages. It wraps a `<button type="button">` that:

1. Shows a confirmation dialog (`confirmMsg`)
2. Fetches the action URL with form data
3. Calls `handle.frame.reload()` to refresh the `adminContent` Frame
4. Shows a pending/loading state via `handle.update()`

Each admin page already wraps it in a `<form method="POST">` with `<CsrfTokenInput />`. The replace approach is identical to the client grid fix: change to `type="submit"` with `data-confirm` + `rmx-target`.

## Decisions

1. **Drop pending label feedback** — The "Wird gelöscht…" text is a micro-interaction that disappears on Frame reload. Acceptable trade-off for removing N clientEntry instances.

2. **Redirect to index route** — After delete, redirect to the admin index fragment URL (e.g., `/admin/lists` or `/admin/messages`). The existing pagination/sort params should be preserved via hidden inputs.

3. **Use `gridStateFromForm` / `gridStateToParams`** — Or equivalent hidden input pattern for admin grid state. Each admin page already has offset/sort state.

## Risks

- Admin pages might not have `ConfirmDelete` in their component tree. Need to add `<ConfirmDelete />` if not present.
- Messages and chatlog don't use structured grid state — need to verify what params to preserve.
