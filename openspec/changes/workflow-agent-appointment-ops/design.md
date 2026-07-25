## Context

The workflow agent currently dispatches on `intent.type`:

- `user-action` → resolve user → navigate → optionally start `userManagementWorkflow`
- `appointment` → pass raw `filter`/`period`/`status` to URL → navigate

The appointment path has no user resolution — `filter` is whatever the LLM guesses. This means "show appointments for John" produces `?filter=John`, which searches appointment title, email, resource name, and resource description — not just John's appointments. If John's email is "john@example.com" it happens to work, but if the admin types "show appointments for user 5", the filter "5" hits everything with a 5 in any searchable field.

Additionally, there is no way to batch-delete appointments for a user on a specific resource, which admins need for cleanup (e.g., "remove all of John's bookings in Raum A").

## Goals / Non-Goals

**Goals:**
- Add user resolution to the appointment-check flow before navigating
- Add a delete-resource action that removes all upcoming appointments for a user+resource combo
- Use a Mastra workflow for the delete path, consistent with the existing `userManagementWorkflow` pattern
- Reuse existing `resolveTargetUser()` from the controller

**Non-Goals:**
- No changes to the appointments page data layer or search logic
- No new route or page — all within the existing workflow-agent page
- No changes to the support agent or its tools
- No changes to customer-facing booking

## Decisions

### Decision 1: User resolution in controller, not LLM

The LLM returns `{"targetQuery": "John"}` and the controller calls `resolveTargetUser("John")` — the same function used by the `user-action` path. This avoids the LLM guessing user IDs or malformed emails.

**Alternatives considered:**
- LLM resolves the user itself via tool calls — adds complexity, no benefit
- LLM passes raw `filter` as today — imprecise, no user scoping

### Decision 2: Email-as-filter for navigation

Once the user is resolved, the controller navigates to `/verwaltung/appointments?filter=<email>`. The appointments page's `ADMIN_SEARCH_COLUMNS` includes `u.email`, so `u.email ILIKE '%john@example.com%'` matches only that user's appointments.

**Alternatives considered:**
- New `userId` query param on the appointments page — cleaner but requires data layer + controller changes in the appointments page. Unnecessary given email search already works.

### Decision 3: New Mastra workflow for delete-resource

A new `deleteUserAppointmentsWorkflow` with 4 steps:

```
preflight
├── input: targetUserId, resourceId, adminUserId
├── DB: SELECT count, list of dates FROM appointments
│        WHERE user_id=$1 AND resource_id=$2 AND date>=today
└── output: { userName, resourceName, upcomingCount, dates }

confirm-gate  ← SUSPENDS
├── suspendPayload: { question, actionType, targetUserName,
│                     resourceName, pendingCount }
└── resume: { confirmed }

execute
├── DELETE FROM appointments
│    WHERE user_id=$1 AND resource_id=$2 AND date>=today
└── output: { deletedCount }

finalize
├── logAdminAction(userId, actionType:'delete-appointments',
│                  details: { resourceId, count })
└── output: { success, deletedCount, targetUserName, resourceName }
```

### Decision 4: Intent schema evolution

```
Current:     {"type":"appointment","filter":"...","period":"...","status":"..."}
New (check): {"type":"appointment","action":"check","targetQuery":"John"}
New (del):   {"type":"appointment","action":"delete-resource",
              "targetQuery":"John","resourceQuery":"Raum A"}
```

The LLM instructions describe the two sub-actions. The controller switches on `intent.action` inside the existing `intent.type === 'appointment'` branch.

## Risks / Trade-offs

- **Email filter collision** — If the user's email is very short or generic (e.g., "a@b.com"), the ILIKE filter could match other rows. Mitigation: `resolveTargetUser` forces exact match lookup first (by ID or email), and only uses the exact email for filtering. The ILIKE with `%` on a full email address is effectively unique.
- **Resource name ambiguity** — `resolveResource` needs a name lookup. If two resources share a name substring, the wrong one could be targeted. Mitigation: require exact match by resource name or ID, and return an error if ambiguous.
- **Workflow resume coupling** — The `resume` endpoint currently only handles `userManagementWorkflow`. Adding a second workflow type means the resume handler needs to branch on workflow ID. Mitigation: use `mastra.getWorkflow(wfId).createRun({ runId })` generically — the run knows its own workflow.
