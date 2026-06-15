## Context

Currently, every paginated controller defines a hardcoded page size constant:

```
USERS_PAGE_SIZE = 15       admin/users
MESSAGES_PAGE_LIMIT = 10   admin/messages
LISTS_PAGE_LIMIT = 10      admin/lists
CHATLOG_PAGE_SIZE = 5      admin/chatlog
PAGE_SIZE = 20              client
PAGE_SIZE = 15              nutzer, appointments-new, appointments,
                            offering-configs, resources
REPORT1_PAGE_SIZE = 20      verwaltung/report1
OFFERINGS_PAGE_SIZE = 12   verwaltung/offerings
```

The settings page already has access to `context.session` but only uses it for auth and flash messages. No mechanism exists for users to change their display density.

## Goals / Non-Goals

**Goals:**
- Add a page size dropdown (10, 15, 20, 25, 50) to the settings page
- Store preference in session (`session.set('pageSize', N)`)
- Read the session override in every paginated controller before falling back to the hardcoded constant
- Override clears on logout (session destroyed)

**Non-Goals:**
- Not storing page size in the database (temporary preference only)
- Not adding per-controller page sizes (single global override)
- Not modifying the paginator utility itself (it already accepts `pageSize` parameter)

## Decisions

### 1. Single global override in session

**Decision:** Store a single `pageSize` value in the session and read it uniformly in every controller.

**Rationale:** Per-controller session keys (`pageSize.adminUsers`, `pageSize.messages`, etc.) would be more flexible but 13x more complex. A global override covers the common case: "I want to see more rows everywhere."

### 2. Read override via shared helper

**Decision:** Create a function `getPageSize(context)` that reads session and returns the override or the controller-specific default.

```ts
// app/utils/get-page-size.ts
import type { RouterContext } from 'remix/router'

export function getPageSize(context: RouterContext, defaultSize: number): number {
  let session = context.session
  let override = session?.get('pageSize')
  if (typeof override === 'number' && [10, 15, 20, 25, 50].includes(override)) {
    return override
  }
  return defaultSize
}
```

**Rationale:** Avoids duplicating the validation/session-read pattern in 13 controllers. One import, one call.

### 3. Settings action uses a hidden `_action` discriminator

**Decision:** Follow the existing pattern — the settings page already uses `_action` to distinguish "delete-account" from "change-password." Add a third action `set-page-size`.

**Rationale:** Consistent with the existing controller architecture. No new routes needed.

## Risks / Trade-offs

- **Session size grows** → Adding one integer to the session is negligible
- **Users expect persistence** → The page size resets on logout. Mitigation: the UI labels it explicitly as "während der Sitzung" (during this session)
- **13 files to touch** → Mechanical but simple — each controller gets one import change and one parameter change. Low risk per file
