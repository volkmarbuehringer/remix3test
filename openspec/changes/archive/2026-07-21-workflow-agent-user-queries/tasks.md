## 1. Instruction Changes

- [x] 1.1 Add "User Queries" section to workflow agent instructions with rule: for general user questions, navigate to /admin/users with appropriate filter param
- [x] 1.2 Add mapping rules: disabled/locked → filter=disabled, active/enabled → filter=enabled, text → filter=<text>
- [x] 1.3 Add rule: query-mode navigation MUST NOT call ask_user

## 2. Verification

- [x] 2.1 Run typecheck
- [x] 2.2 Run workflow agent tests
