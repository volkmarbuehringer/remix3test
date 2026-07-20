## 1. Implement Value Restoration

- [x] 1.1 Add `restoreFilterValue(url)` helper that sets `input[name="filter"].value` from URL params
- [x] 1.2 Call helper after `frame.reload()` in `handleNavigate` in `workflow-agent-stream.tsx`
- [x] 1.3 Call helper after `frame.reload()` in GET branch of `handleFrameFormSubmit` in `workflow-agent-stream.tsx`
- [x] 1.4 Apply same fix to `handleNavigate` in `route-agent-stream.tsx`
- [x] 1.5 Run typecheck

## 2. Verify

- [ ] 2.1 Test agent navigate to `/admin/users?filter=test` — filter input shows "test"
- [ ] 2.2 Test manual filter form submission — filter input shows submitted value
