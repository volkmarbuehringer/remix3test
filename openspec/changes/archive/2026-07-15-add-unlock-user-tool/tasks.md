## 1. Modify lookupUser to return disabled_at

- [x] 1.1 Add `disabled_at` to the SQL SELECT in `lookupUser` execute function
- [x] 1.2 Add `disabledAt` to the response object in `lookupUser`
- [x] 1.3 Update `lookupUser` description to mention disabled status

## 2. Add lockUserAccount tool

- [x] 2.1 Add `lockUserAccount` tool definition with `requireApproval: true` and `inputSchema` accepting `targetUserId`
- [x] 2.2 Implement execute: check for self-lock, query user existence, set `disabled_at`, return idempotent success if already locked

## 3. Add unlockUserAccount tool

- [x] 3.1 Add `unlockUserAccount` tool definition with `requireApproval: true` and `inputSchema` accepting `targetUserId`
- [x] 3.2 Implement execute: check user existence, clear `disabled_at`, increment `token_version`, return idempotent success if already active

## 4. Verify

- [x] 4.1 Run typecheck to ensure no TypeScript errors
- [x] 4.2 Verify tools are auto-picked up by support-agent (no agent registration change needed)
