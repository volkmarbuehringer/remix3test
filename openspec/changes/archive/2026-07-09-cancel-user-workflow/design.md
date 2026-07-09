## Context

The support agent (`supportAgent` in `app/actions/mastra/agents/support-agent.ts`) has 17 read-only tools and zero mutation capabilities. It can look up users, appointments, resources, and messages, but cannot act on them. Admins who need to cancel a user must leave the chat and use admin UI pages.

The customer agent (`customerAgent`) already uses a proven pattern for mutations: tools call Mastra workflows via `workflow-executor.ts`, and the authenticated user ID is injected via `runWithUserId` (AsyncLocalStorage). The support agent has no equivalent mechanism — its tools have no access to the admin's identity for audit logging or authorization.

The `users` table has `token_version` (session invalidation) and `email` (UNIQUE constraint for re-registration blocking) but no `disabled` flag. Login gates check `token_version` match and `email_verified` status but have no concept of a deactivated account.

## Goals / Non-Goals

**Goals:**
- Add a `disabled_at BIGINT` column to the `users` table
- Add `runWithAdminId` / `requireAdminId` ALS helpers mirroring the existing `runWithUserId` pattern
- Add a `cancel_user_account` tool to `support-tools.ts`
- Add `cancelUserWorkflow` with 5 steps: validate target, delete future appointments, disable account, audit log, notify user
- Register the workflow in the Mastra orchestrator
- Add `disabled_at` checks to both password login (`verifyCredentials`) and session verify (auth scheme `verify`)
- Wire `runWithAdminId` in the mastra chat controller

**Non-Goals:**
- No changes to the customer agent, customer chat, or customer booking workflows
- No admin UI changes or new routes
- No soft-delete for appointments (they are actually deleted)
- No reactivation workflow (setting `disabled_at = NULL` is handled manually if needed)
- No changes to the existing self-service `deleteUser` in settings
- No changes to registration flow (UNIQUE constraint already blocks re-registration)

## Decisions

### Decision 1: `disabled_at` timestamp instead of boolean or status enum

A nullable `disabled_at BIGINT` column tells you not just *that* the account is disabled, but *when* it happened. NULL = active. A timestamp also enables future queries like "how many accounts were disabled last month?" A boolean `disabled` flag would need a separate `disabled_at` column anyway for audit purposes.

**Alternatives considered:**
- `status TEXT DEFAULT 'active'` — more expressive but unnecessary for this use case; adds string comparison overhead and possible invalid values
- Reusing `token_version = -1` as a sentinel — fragile, not self-documenting
- No migration, just randomize `password_hash` — indistinguishable from a bug, no audit trail

### Decision 2: AsyncLocalStorage for admin identity (matching customer agent pattern)

The customer agent's tools use `runWithUserId` + `requireCurrentUserId()` to get the authenticated user. The support agent will use the identical pattern with `runWithAdminId` + `requireAdminId()`. The storage is set before `agent.generate()` in the controller and propagates through tool executions via Node.js AsyncLocalStorage.

**Alternatives considered:**
- Passing admin ID through memory `resource` field — fragile, requires parsing from agent runtime state
- Looking up admin identity from the Mastra thread — no reliable API for this mid-tool-execution
- A separate middleware that injects into the tool's `context` — would require changing every tool signature

### Decision 3: First mutation tool uses workflow (not direct DB write)

Even though a simple `UPDATE users SET disabled_at = now()` could be a one-liner, using a workflow establishes the pattern for all future admin mutations. The 5-step workflow provides validation, audit logging, notification, and idempotency guarantees that a direct tool would need to reimplement.

**Alternatives considered:**
- Direct tool with inline DB writes — simpler but every future admin mutation would reimplement the same patterns
- Tool→workflow with a generic `executeAdminWorkflow` helper — adds abstraction before we know the common patterns

### Decision 4: Future appointments only (not past)

`DELETE FROM appointments WHERE user_id = $1 AND date > $now` keeps historical data for reports, audit trails, and billing. Past appointments remain in the system with the user's ID for join purposes.

**Alternatives considered:**
- Cascade-delete all — loses historical data
- Soft-delete appointments (status = 'cancelled_by_admin') — more complex, the FK cascade already handles cleanup

### Decision 5: Login gate checks `disabled_at` in three places

Three code paths need the check:
1. `verifyCredentials` (password login) — `if (user.disabled_at) return null`
2. Session `verify` (auth scheme) — `if (user.disabled_at) return null`
3. `apiTokenAuth` (API token middleware) — `if (user.disabled_at) return 401`

The registration path needs no change: `findOne(users, { where: { email } })` finds the row (even disabled), and the UNIQUE constraint prevents duplicate email insertion.

## Architecture

```
                    mastra chat controller
                    ┌────────────────────────────┐
                    │ runWithAdminId(user.id,    │
                    │   () => agent.generate(    │
                    │     message, { ... }       │
                    │   )                        │
                    └─────────────┬──────────────┘
                                  │ ALS propagation
                                  ▼
                    support-tools.ts
                    ┌────────────────────────────┐
                    │ cancelUserAccount tool      │
                    │   requireAdminId() → 1     │
                    │   requireTargetUserId(42)  │
                    │   executeCancelUserWf({    │
                    │     targetUserId,           │
                    │     adminUserId,            │
                    │     adminEmail              │
                    │   })                        │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    workflow-executor.ts
                    ┌────────────────────────────┐
                    │ executeCancelUserWorkflow() │
                    │   getWorkflow(wf)           │
                    │   createRun() .start()      │
                    └─────────────┬──────────────┘
                                  │
                                  ▼
                    cancel-user-workflow.ts
                    ┌────────────────────────────┐
                    │ 1. validate-target          │
                    │    ├── user exists?         │
                    │    ├── not admin?           │
                    │    └── not already disabled │
                    │                             │
                    │ 2. delete-future-appts      │
                    │    DELETE WHERE             │
                    │    user_id=$1 AND date>now  │
                    │                             │
                    │ 3. disable-account          │
                    │    SET disabled_at=now,     │
                    │    token_version=tv+1       │
                    │                             │
                    │ 4. audit-log                │
                    │    INSERT INTO audit_logs   │
                    │                             │
                    │ 5. notify-user (best-effort)│
                    └────────────────────────────┘
```

### Data Flow

```
Admin: "Cancel user Klaus Müller"
  → agent calls lookup_user("Klaus Müller")
  → returns { id: 42, name: "Klaus Müller", ... }
  → agent confirms: "Found Klaus Müller (ID 42, 3 future appointments). Confirm?"
  → Admin: "Yes, cancel them"
  → agent calls cancel_user_account({ targetUserId: 42 })
  → tool: requireAdminId() → 1
  → tool: SELECT email FROM users WHERE id = 1 → "admin@example.com"
  → tool: executeCancelUserWorkflow({ targetUserId: 42, adminUserId: 1, adminEmail: "admin@example.com" })
  → workflow starts

  Step 1: validate-target
    SELECT id, email, name, role, disabled_at FROM users WHERE id = 42
    → { id: 42, email: "klaus@example.com", role: "customer", disabled_at: null }
    → valid: true

  Step 2: delete-future-appointments
    DELETE FROM appointments WHERE user_id = 42 AND date > 1789000000000
    → 3 rows deleted

  Step 3: disable-account
    UPDATE users SET disabled_at = 1789000123000, token_version = token_version + 1
    WHERE id = 42 AND disabled_at IS NULL
    → 1 row affected

  Step 4: audit-log
    INSERT INTO audit_logs (admin_user_id=1, admin_email="admin@...",
      action_type="user_cancelled", target_type="user", target_id="42",
      details='{"targetEmail":"klaus@...","targetName":"Klaus Müller","deletedAppointments":3}', ...)
    → logged

  Step 5: notify-user
    sendAccountDeletionEmail(mailer, { name: "Klaus Müller", email: "klaus@..." }, 'admin')
    → sent (or enqueued on failure)

  → workflow returns { success: true, targetUserId: 42, deletedAppointments: 3, notificationSent: true }
```

### Login Gate Changes

**`app/middleware/auth.ts` — `verify` (session):**
```typescript
if (user.disabled_at != null) return null   // NEW
if (user.token_version !== value.tv) return null
```

**`app/middleware/auth.ts` — `verifyCredentials` (password):**
```typescript
if (user.disabled_at != null) return null   // NEW
if (user.role !== 'admin' && user.email_verified !== 1) return null
```

**`app/middleware/api-token-auth.ts` — `apiTokenAuth`:**
```typescript
if (user.disabled_at != null) {
  return Response.json({ error: 'Account disabled' }, { status: 401 })
}
if (user.role !== 'admin' && user.email_verified !== 1) { ... }
```

### Migration

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at BIGINT
```

Idempotent. No data migration needed (existing rows stay NULL).

### API Token Revocation

The `disable-account` step also revokes all outstanding API tokens for the target user:
```sql
UPDATE api_tokens SET revoked_at = now WHERE user_id = $targetUserId AND revoked_at IS NULL
```
This prevents a disabled user from authenticating via any existing API tokens.

## Risks / Trade-offs

| Risk | Mitigation |
|------|-----------|
| Admin accidentally cancels wrong user | Agent looks up user first (read tool), confirms with admin before firing mutation tool |
| Workflow fails mid-step (e.g., appointments deleted but account not disabled) | Each step has idempotent guards; re-running the workflow on the same user is safe (disabled_at IS NULL check in step 3) |
| Notification send fails and user doesn't know their account was cancelled | Notification is best-effort; audit log always captures the action; admin can see the result in the agent's response |
| Past appointments reference a now-disabled user in UI | Appointments keep the user_id FK; the user row still exists, just with disabled_at set — queries that check disabled_at before showing user info would need separate handling |
| `disabled_at` adds a column that every auth query must check | One nullable BIGINT column with an index; the check is a single `IS NULL` comparison — negligibly performance impact |
| ALS does not propagate through agent.generate() internally | Already proven by the existing customer agent pattern (runWithUserId works) |
