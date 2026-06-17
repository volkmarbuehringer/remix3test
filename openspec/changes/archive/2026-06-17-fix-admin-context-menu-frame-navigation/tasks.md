## 1. Refactor nutzer-table-interactive to ref-based pattern

- [x] 1.1 Remove `attachContextMenuListeners` standalone function, inline logic into `ref()` callback on the trigger div
- [x] 1.2 Remove `let mounted = false` — the ref callback's AbortSignal handles cleanup
- [x] 1.3 Read table data from `readData()` inside the event handler (not closure-captured) so data is fresh on every right-click
- [x] 1.4 Call `handle.update()` directly in the event handler before trigger dispatch (replaces `onRowChange` callback)
- [x] 1.5 Use `ref()`'s AbortSignal for listener cleanup instead of `handle.signal`

## 2. Fix ref-based context menus (remove mounted guard)

- [x] 2.1 `admin-resources-context-menu.tsx` — remove `if (mounted) return` from ref callback, keep signal-based cleanup
- [x] 2.2 `admin-offering-configs-context-menu.tsx` — same fix
- [x] 2.3 `admin-users-context-menu.tsx` — same fix
- [x] 2.4 `admin-offerings-context-menu.tsx` — same fix
- [x] 2.5 `admin-appointments-context-menu.tsx` — same fix

## 3. Fix client-grid-inline-edit

- [x] 3.1 Replace `let mounted = false` + `handle.signal` pattern with table-identity tracking using a cached DOM reference
- [x] 3.2 Use per-attachment `AbortController` to clean up previous listener when table DOM node is replaced

## 4. Verification

- [x] 4.1 Run `npm run typecheck` — no type errors
- [x] 4.2 Run `npm test` — no regressions
