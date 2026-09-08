---
name: remix3-frame-unsaved-draft
description: "Use when a Remix 3 frame-based editor has a 'create new' mode with no server id yet and navigating away would silently lose the typed content — beforeunload can't flush it (no id) and doesn't reliably prompt for frame navigations; persist a sessionStorage draft and restore it on the next new-record render."
metadata:
  origin: auto-extracted
---

# Remix 3 frame editor: persist an unsaved "create new" draft

**Extracted:** 2026-09-08
**Context:** The /lists editor — a Remix 3 `clientEntry` editor with a "new list"
mode (`loadedListId === null`) alongside saved lists.

## Problem
A brand-new record in a Remix 3 frame editor has no id, so the common
"flush on unload" trick cannot work:

- `flushOnUnload` (a `beforeunload` handler using `fetch(..., { keepalive: true })`)
  bails out immediately when there's no id — there is nothing to PUT to
  (`lists-client.tsx:1124: if (loadedListId === null) return`).
- Relying on `beforeunload`'s confirm dialog to stop navigation is unreliable for
  Remix 3 `<Frame>` navigations: clicking a `NavLink target={frameTarget}`
  navigates the inner frame, and browsers generally suppress the "leave site?"
  dialog for sub-frame navigations.

Net effect: the user types a half-finished new list, clicks another list in the
sidebar, and the content is lost with no warning.

## Solution
Persist a session-scoped draft in `sessionStorage` as the user types, and restore
it the next time the editor renders the "create new" (no initial-state) branch.
The draft lives only for the tab session and is cleared the moment the record is
saved (an id exists) or the user explicitly discards it.

In practice (`lists-client.tsx`):
- Keep one `DRAFT_KEY`. On every mutation of the new record, write
  `sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ ...fields }))` — but only
  while there is no id yet, so it never touches the saved-record path.
- Call the save-draft helper from the same `setDirty`-style dirty tracker, and
  run it **before** the dirty early-return, so reverting the draft back to clean
  clears the stored draft instead of leaving it stale.
- In the reload/restore handler, the "no initial state: start new" branch should
  first check `loadDraft()`; if a draft exists, hydrate from it, mark it dirty,
  and show a "restored draft" banner with a discard button.
- Clear the draft when the save succeeds (new id assigned) or via the discard
  button (`clearDraft()`).

```ts
const DRAFT_KEY = 'lists:draft:new'

let loadDraft = (): ListInitialState | null => {
  if (typeof sessionStorage === 'undefined') return null
  try {
    let raw = sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    let data = JSON.parse(raw)
    if (data && typeof data === 'object') {
      return { id: 0, title: data.title, description: data.description,
               items: Array.isArray(data.items) ? data.items : [], updated_at: 0 }
    }
  } catch { /* ignore corrupt draft */ }
  return null
}
let clearDraft = () => {
  if (typeof sessionStorage === 'undefined') return
  try { sessionStorage.removeItem(DRAFT_KEY) } catch {}
  draftRestored = false
}
let saveDraft = () => {
  if (loadedListId !== null) return        // only the "create new" path
  if (typeof sessionStorage === 'undefined') return
  if (!isDirty()) { clearDraft(); return } // revert to clean clears the draft
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ title, description, items })) } catch {}
}
let setDirty = () => {
  saveDraft()                              // run before the dirty early-return
  if (!isDirty()) return
  // ... status pill + scheduleAutosave
}
```

## When to Use
- A Remix 3 `clientEntry` editor has both a "create new" (no id) and an
  "edit existing" (has id) mode, and the save mechanism is id-based
  (PUT /:id), so it can't run without an id.
- You are tempted to use a `beforeunload` confirm or a `keepalive` fetch to guard
  unsaved new content.
- Navigating away within a `<Frame target=...>` would otherwise discard the draft.

## Notes
- Guard every `sessionStorage` access with `typeof sessionStorage === 'undefined'`
  and wrap in try/catch — storage can be unavailable or in private mode.
- `sessionStorage` is per-tab, so drafts don't leak across tabs; use
  `localStorage` only if you want cross-tab persistence (the wrong default for a
  draft).
- Validate the parsed value defensively (guard against a corrupt/`{}` value).
