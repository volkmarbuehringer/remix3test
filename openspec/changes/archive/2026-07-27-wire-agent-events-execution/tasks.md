## 1. Context Propagation

- [x] 1.1 Add `adminUserId` and `adminEmail` fields to the `request.received` event type in `event-bus.ts`
- [x] 1.2 Expand `pendingConfirmMap` value type in `controller.tsx` to store `intent`, `targetUserId`, `targetQuery`, `adminUserId`, `adminEmail` alongside `message` and `expiresAt`
- [x] 1.3 Populate full context from the controller's `action` handler before emitting `request.received`
- [x] 1.4 Pass stored context into `confirm.resolved` payload on resume

## 2. Real DB Lookup in resolve.ts

- [x] 2.1 Import `db` from `../../data/connection.ts` into `handlers/resolve.ts`
- [x] 2.2 Replace pattern-based entity resolution with `resolveTargetUser()` logic: numeric ID → `SELECT id FROM users WHERE id = $1`, name/email → `SELECT id, name, email FROM users WHERE name ILIKE $1 OR email ILIKE $1`
- [x] 2.3 Emit `entities.notfound` with descriptive error when no user found or multiple match
- [x] 2.4 Pass `adminUserId` and `adminEmail` through emitted events

## 3. Real Execution in execute.ts

- [x] 3.1 Import `executeCancelUserWorkflow`, `executeLockUserWorkflow`, `executeUnlockUserWorkflow` from `../../mastra/workflow-executor.ts`
- [x] 3.2 Map intents to executor functions: `cancel-user` → `executeCancelUserWorkflow`, `lock-user` → `executeLockUserWorkflow`, `unlock-user` → `executeUnlockUserWorkflow`
- [x] 3.3 Call the mapped executor with `targetUserId`, `adminUserId`, `adminEmail` from the resume payload
- [x] 3.4 Emit `action.completed` with `success: true` and the result on success, or `success: false` with error on failure/catch

## 4. Integration Tests

- [x] 4.1 Update EventBus unit tests to cover the DB-backed resolve path
- [x] 4.2 Update EventBus unit tests to cover the real execute path (may require mocking workflow-executor)
- [x] 4.3 Verify full pipeline end-to-end: POST cancel/lock/unlock → SSE events → confirm → resume → action.completed
