## Context

The support agent has 18 tools for querying appointments, resources, users, and generating reports. Only `cancelUserAccount` modifies account status — and it is destructive (deletes future appointments). There is no way to:

- Check if a user is currently disabled via the `lookupUser` tool (it omits `disabled_at`)
- Re-enable a previously disabled user
- Lock a user without deleting their appointments

The `users` table already has a `disabled_at` column (nullable bigint). Setting it to a timestamp disables the account; setting it to null re-enables it. Auth middleware (`auth.ts`, `api-token-auth.ts`) checks this column on every request.

## Goals / Non-Goals

**Goals:**

- Add `disabled_at` to the `lookupUser` tool response so agents can report account status
- Add `lockUserAccount` tool to set `disabled_at` without side effects (non-destructive)
- Add `unlockUserAccount` tool to clear `disabled_at` and increment `token_version` to invalidate existing sessions

**Non-Goals:**

- No changes to `cancelUserAccount` workflow behavior
- No data model or migration changes
- No UI changes
- No legacy `nutzer` system changes

## Decisions

**1. `lockUserAccount` is separate from `cancelUserAccount`**

- `cancelUserAccount` is a workflow — it deletes future appointments, revokes API tokens, and sends notifications. That's appropriate for account cancellation but excessive for temporary locking.
- `lockUserAccount` is a simple tool: sets `disabled_at = EXTRACT(EPOCH FROM NOW()) * 1000` and returns success. No side effects.
- Both set `disabled_at`, but only `cancelUserAccount` touches appointments and tokens.

**2. `unlockUserAccount` increments `token_version`**

- When a user is locked while logged in, their session is still valid (auth checks `disabled_at` on each request). Locking prevents new requests, but the session cookie remains.
- On unlock, incrementing `token_version` invalidates all existing sessions, forcing the user to log in again. This prevents stale sessions from carrying over after re-enablement.
- `cancelUserAccount` already does this; `unlockUserAccount` follows the same pattern.

**3. Both lock/unlock tools use `requireApproval: true`**

- Matches the pattern set by `cancelUserAccount`. Account status changes are sensitive operations.
- The agent will present the action to the admin for confirmation before executing.

**4. Both tools return idempotent success responses**

- Locking an already-locked user: returns `{ success: true, message: "User account is already locked" }`
- Unlocking an already-active user: returns `{ success: true, message: "User account is already active" }`
- This lets the agent report the current state without confusion.

## Risks / Trade-offs

- [No rollback] `unlockUserAccount` sets `disabled_at = NULL` and increments `token_version`. There is no "last known disabled_at" history. This is acceptable because unlocking is always intentional and the previous disabled_at value has no semantic meaning.
- [Self-lock] An admin could ask the agent to lock their own account. `cancelUserAccount` blocks this with a self-account check. The same guard should apply to `lockUserAccount`.
- [Race condition] Two concurrent unlock requests would each increment `token_version`. This is benign — `token_version` is only used for inequality checks, and incrementing extra times just forces extra re-logins.
