## 1. Frame-Aware Utilities

- [x] 1.1 Create `app/utils/frame-utils.ts` with `safeReload(handle)` that detects agent frame containers and reloads the active frame, falling back to `window.location.reload()`
- [x] 1.2 Add `safeNavigate(href, handle)` that navigates the active frame when inside an agent frame, falling back to `window.location.href = href`

## 2. Frame Form Intercept

- [x] 2.1 Add `handleFrameFormSubmit` to `app/assets/support-agent-stream.tsx` that intercepts all form submits from within the frame container, sends them via `fetch()`, and reloads the active frame
- [x] 2.2 Register the `submit` listener on `#support-agent-frame-container` in the ref callback, skipping `#support-agent-form` submits
- [x] 2.3 Wire the fetch response back to the agent as an answer when a pending question exists (JSON responses only)

## 3. Update Client Entries

- [x] 3.1 Update `app/assets/nutzer-table-interactive.tsx` to use `safeReload(handle)` instead of `window.location.reload()` in the lock/unlock, activate/deactivate, reset-password, and delete handlers
- [x] 3.2 Update `app/assets/nutzer-table-interactive.tsx` to use `safeNavigate(href, handle)` instead of `window.location.href =` in the edit handler
- [x] 3.3 Audit other client entries for `window.location.reload()` and `window.location.href =` patterns, and update those found

## 4. Verification

- [x] 4.1 Run `npm run typecheck` to verify no type errors
- [x] 4.2 Run `npm test` to verify existing tests pass
