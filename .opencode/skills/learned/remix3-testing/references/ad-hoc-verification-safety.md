# Ad-Hoc Browser Verification Must Not Mutate a Persistent Database

**Source:** session 2026-09-30 — fixing the `/lists` overflow menu, then verifying it against the running dev server (port 44100, which uses the real `DATABASE_URL`).

## Problem

Clicking through the running dev app is fine for read-only checks, but the dev server shares the persistent development database. Exercising a **destructive** control to prove a behavior (here: that the "⋯ Weitere Aktionen" menu closes after choosing an action) executed a real, permanent deletion.

The trap is the app's **two-step arm/confirm** control (`clearAll` in `app/actions/lists/public/lists-client.tsx`): the first click only arms (`clearArmed = true`, label flips to "Wirklich alle löschen?") and starts a 4 s disarm timer; **a second click within the window deletes every item and autosaves**. A script that "reopens the menu and clicks confirm to test dismissal" performs a live delete.

Live destructive controls to avoid in ad-hoc checks:

- `/lists` overflow menu → `✕ Alle löschen` (arm → confirm), `✕ Auswahl löschen`, `✔ Nur Erledigte löschen`
- row/sidebar delete forms (`data-confirm` → `ConfirmDelete`)

## Solution

1. **Prove a destructive-sounding behavior with a non-destructive path.** To show the menu dismisses, open it and dismiss via an outside click or `Escape`, or assert `details[open]` — do not fire the action. See `lists-client-ops.test.e2e.ts` → "dismisses the overflow menu on outside click and Escape".
2. **Run destructive paths in the ephemeral test DB, never the dev server.** `t.serve(await createTestServer((request) => router.fetch(request)))` with self-seeded rows, deleted only in `finally` (`DELETE FROM lists WHERE id = $1`). See `state-isolation-and-e2e-serve.md`.
3. **If an ad-hoc check must touch a persistent DB, snapshot first** (row ids / counts) and avoid any control whose click can commit a write.
4. **Separate selection from mutation.** Selection is often view-only (the copy-target checkboxes do not mark the list dirty); selection-only interactions are safe to automate.

## When to Use

- You are about to verify a UI change with Playwright/`curl` against the running dev server and the path includes a delete/reset/confirm control.
- A control arms on the first click and confirms on the second (label flips to "Wirklich …?"); a scripted double-click is a live delete.
- You want regression coverage for a destructive path — write it as a `*.test.e2e.ts` against seeded rows.
