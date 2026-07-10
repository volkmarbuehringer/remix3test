## Context

Each list entry in the sidebar (`app/ui/lists-layout.tsx:146-176`) is a `<div>` containing a `NavLink` (`<a>`) with a `<span>` for the list name, a count badge, and a delete form. The name comes from the `description` column in the `lists` table.

The existing `PUT /lists/:id/update` endpoint requires a full `description + items` payload — too heavy for a simple rename. A dedicated lightweight endpoint avoids the overhead of re-fetching/retransmitting items.

The project uses `clientEntry()` components for client-side interactivity (see `confirm-delete.tsx`, `lists-client.tsx`) with event delegation patterns.

## Goals / Non-Goals

**Goals:**

- Double-click a list name in the sidebar to enter inline edit mode
- Show a text input pre-filled with the current name
- Save on Enter or blur (via PUT with new description)
- Cancel on Escape (restore original name)
- Update the span text on success (no page reload)
- Show a brief error state if save fails (restore original)

**Non-Goals:**

- Changing the existing `PUT /lists/:id/update` schema (keeps full-save path intact)
- Editing via the admin lists sidebar
- Animations, optimistic UI, or undo
- Changing the data model

## Decisions

1. **New lightweight route** — Add `put('/:id/rename')` to the lists route tree that accepts `{ description: string }` only. This avoids coupling the inline rename to the full-save endpoint.

2. **New clientEntry component** — Create `app/assets/list-name-edit.tsx` modeled after `confirm-delete.tsx`:
   - Invisible wrapper div (like ConfirmDelete) with a `ref` for event binding
   - Delegated `dblclick` listener on `[data-list-sidebar-entry]` parent divs
   - On dblclick: replace the name `<span>` with an `<input>`, focus it, select all text
   - On Enter / blur: send `PUT /lists/:id/rename` with JSON `{ description: newValue }`
   - On Escape: cancel, restore original span
   - Uses CSS classes to toggle visibility of span vs input (avoid layout shift)

3. **Data attributes on sidebar entries** — Add `data-list-id` to each sidebar entry row and `data-list-name` to the name span so the clientEntry can identify elements without coupling to HTML structure.

4. **No server round-trip for the whole sidebar** — After a successful rename, update the span text directly. The controller will re-fetch sidebar entries on next frame reload anyway (which happens when user clicks another list).

5. **Styling** — Inline input matches the existing link text style (same font, size, color) with a subtle focus border matching the theme's `focus.ring` color.

## Risks / Trade-offs

- If the PUT fails (network error / 500), the input reverts to the original name and a brief error state shows. No data loss.
- The rename only updates the sidebar span. Other parts of the app (admin list table, etc.) won't reflect the new name until their page reloads — acceptable since the rename is done from the lists page.
- Race condition: if user renames rapidly, in-flight requests may complete out of order. Mitigation: disable the input during save and ignore responses from stale requests using an AbortController per entry.

## Server-side Changes

**routes.ts** — Add `rename: put('/:id/rename')` to the `lists` route group.

**controller.tsx** — Add `rename` action:

- Parse `{ description: string }` with `s.object({ description: s.string().pipe(minLength(1), maxLength(500)) })`
- Call `renameList(db, id, description, userId)` which updates only the `description` column and `updated_at`
- Return `{ id, description }` on success, `{ error }` on failure

**lists-api.ts** — Add `renameList(db, id, description, userId)` function that only updates `description` and `updated_at`.

## Client-side Changes

**lists-layout.tsx** — Add `data-list-id` to each sidebar entry div, `data-list-name` to the name span. Import and render `<ListNameEdit />` in the sidebar `<nav>`.

**app/assets/list-name-edit.tsx** (new) — clientEntry component:

- Attaches delegated `dblclick` listener on the nav container
- On double-click: finds the target span, hides it, inserts an input
- Handles Enter/blur/Escape via listeners on the input
- Saves via `PUT /lists/:id/rename` with CSRF token header
- On success: updates span text, hides input
- On failure: restores original, shows error indicator
