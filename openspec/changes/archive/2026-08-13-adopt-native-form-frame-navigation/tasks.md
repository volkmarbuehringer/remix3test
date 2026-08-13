## 1. Add `rmx-target` to the grid filter form

- [x] 1.1 Add `rmx-target="admin-content"` to the `method="GET"` form at `app/actions/client/grid-page.tsx` (filter bar, ~line 363)
- [x] 1.2 Verify the filter input's `defaultValue={filter ?? ''}` still restores the query param after a frame reload

## 2. Remove the workflow-agent generic form shim

- [x] 2.1 Delete `handleFrameFormSubmit` (`app/assets/streams/workflow-agent-stream.browser.tsx`, ~lines 451-488)
- [x] 2.2 Delete the container `submit` listener that calls it (line ~512)
- [x] 2.3 Keep `restoreFilterValue` and its other call site (line ~391, via frame navigation)

## 3. Verify kept interceptors

- [x] 3.1 Confirm the route agent interceptor stays untouched (`route-agent-stream.browser.tsx:379`)
- [x] 3.2 Confirm the support agent interceptor stays untouched (`support-agent-stream.browser.tsx:500`)

## 4. Verify

- [x] 4.1 `npm run typecheck`
- [x] 4.2 `npm test` (expect 1082 pass, 0 fail)
- [x] 4.3 `npm run format:fix` then confirm prettier is clean
