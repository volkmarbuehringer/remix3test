## 1. Frame Fetch Caching

- [x] 1.1 Add `cache: 'no-store'` to the `fetch` call in `app/assets/entry.tsx:45`
- [x] 1.2 Verify existing tests still pass (`npm test`)

## 2. Navigation Error Visibility

- [x] 2.1 Fix `app/assets/streams/agent-events-stream.browser.tsx:199` — replace `() => {}` with a call to `showInfo('Navigation failed', true)` or similar user-visible error
- [x] 2.2 Fix `app/assets/streams/workflow-agent-stream.browser.tsx:388` — replace `() => {}` with a call to `showInfo('Navigation failed', true)` or similar user-visible error

## 3. Unhandled Rejection Fixes

- [x] 3.1 Add `.catch(() => {})` to `app/ui/connection-indicator.browser.tsx:71` — SSE invalidate reload is background, silent suppression is correct
- [x] 3.2 Add `.catch()` to `app/ui/grid-refresh-button.browser.tsx:31` — user-initiated refresh should reset `pending` state on error

## 4. Verification

- [x] 4.1 Run typecheck: `npm run typecheck`
- [x] 4.2 Run tests: `npm test`
