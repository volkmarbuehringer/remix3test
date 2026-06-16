## 1. User-Facing Controller — Create Action

- [x] 1.1 In `app/actions/appointments-new/controller.tsx` `create` action: after line 558 (`let params = gridStateToParams(gridValues)`), clear `period`, `filter`, and `offset` from the `gridValues`/`params` before redirect. The redirect at line 560 should use a clean params object with those fields omitted.

## 2. User-Facing Controller — Update Action

- [x] 2.1 In `app/actions/appointments-new/controller.tsx` `update` action: after line 694 (`let params = gridStateToParams(gridValues)`), clear `period`, `filter`, and `offset` from `gridValues` before building the redirect (line 696).

## 3. User-Facing Controller — Destroy Action

- [x] 3.1 In `app/actions/appointments-new/controller.tsx` `destroy` action: after line 732 (`let params = gridStateToParams(gridStateFromFormData(formData))`), clear `period`, `filter`, and `offset` from the grid state before building the redirect (line 734).

## 4. Admin Controller — Create Action

- [x] 4.1 In `app/actions/verwaltung/appointments/controller.tsx` `create` action: after line 518 (`let params = gridStateToParams(gridValues)`), clear `period`, `filter`, and `offset` from `gridValues` before building the redirect (line 521).

## 5. Admin Controller — Update Action

- [x] 5.1 In `app/actions/verwaltung/appointments/controller.tsx` `update` action: after line 731 (`let params = gridStateToParams(gridValues)`), clear `period`, `filter`, and `offset` from `gridValues` before building the redirect (line 733).

## 6. Admin Controller — Destroy Action

- [x] 6.1 In `app/actions/verwaltung/appointments/controller.tsx` `destroy` action: after line 784 (`let params = gridStateToParams(gridStateFromFormData(formData))`), clear `period`, `filter`, and `offset` from the grid state before building the redirect (line 786).

## 7. Validation

- [x] 7.1 Run `npm test` to verify all tests pass (3 existing tests updated to match new behavior)
- [x] 7.2 Run `npm run typecheck` to verify types
