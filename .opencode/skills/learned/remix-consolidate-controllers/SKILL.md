---
name: remix-consolidate-controllers
description: "Mechanical process for merging flat kebab-case Remix 3 controllers into feature directories with named exports"
user-invocable: false
origin: auto-extracted
---

# Remix 3 Controller Consolidation

**Extracted:** 2026-06-07
**Context:** Migrating flat `app/actions/<feature>/controller.tsx` directories (e.g., `auth-login/`, `admin-chatlog/`) into parent feature directories (e.g., `auth/`, `admin/`) with named exports.

## Problem

Flat kebab-case controller directories (`app/actions/auth-login/controller.tsx`, `app/actions/admin-chatlog/`) work correctly but produce `remix doctor` "does not match any route map" warnings and scatter related logic across many directories. The timeboxer demo pattern consolidates sub-route controllers into the parent's `controller.tsx` as named exports, but doing this mechanically requires handling naming conflicts, import deduplication, type exports, and router updates.

## Solution

### Step 1: Plan the consolidation

Identify which flat dirs map to which parent:

```
Flat dir              Route key              Parent dir
auth-login/           routes.auth.login      auth/
admin-chatlog/        routes.admin.chatlog   admin/
admin-offerings/      routes.verwaltung.offerings  verwaltung/
agent/                routes.ai.agent        ai/
```

Count total lines of all source controllers to anticipate file size.

### Step 2: Identify naming conflicts

When merging multiple controllers, scan for:

**Constant conflicts** — same name used in multiple files with different values:
```
PAGE_SIZE = 5    (chatlog)
PAGE_SIZE = 15   (users)       → must rename each uniquely
PAGE_SIZE = 12   (offerings)
```

Prefix with controller name: `CHATLOG_PAGE_SIZE`, `USERS_PAGE_SIZE`, `OFFERINGS_PAGE_SIZE`.

**Type conflicts** — same type name with different shapes:
```
interface ResourceOption { id: string; description: string }     // offerings
interface ResourceOption { id: number; description: string }     // offering-configs
```
Rename: `OfferingsResourceOption`, `OfferingConfigResourceOption`.

**Schema conflicts** — same `createSchema`/`updateSchema` in multiple controllers:
Rename: `appointmentCreateSchema`, `appointTypeCreateSchema`.

### Step 3: Merge imports

Collect all imports from source files by category (remix, app modules, UI), deduplicate. Remove UI-only imports (`Handle`, `css`, `theme`, page components) if extracting pages to `pages.tsx`.

### Step 4: Check for external type consumers

UI files may import types from the flat controller paths:

```typescript
// Old — fails after deleting flat dir:
import type { AppointmentRow, ResourceOption } from '../actions/admin-appointments/controller.tsx'

// New — point to consolidated file with renamed types:
import type { AppointmentRow, AppointmentResourceOption } from '../actions/verwaltung/controller.tsx'
```

Add `export` to all type interfaces that UI files consume. Search: `grep -r "from.*<old-path>" app/ui/`.

### Step 5: Convert defaults to named exports

```typescript
// Before (in separate files):
export default createController(routes.auth.login, { ... })  // auth-login/controller.tsx
export default createController(routes.auth.register, { ... }) // auth-register/controller.tsx

// After (in parent controller.tsx):
export const authLogin = createController(routes.auth.login, { ... })
export const authRegister = createController(routes.auth.register, { ... })
```

The parent route keeps its default export only if it's the only one (otherwise all become named).

### Step 6: Update router.ts

Replace individual imports with a single consolidated import:

```typescript
// Before:
import loginController from './actions/auth-login/controller.tsx'
import registerController from './actions/auth-register/controller.tsx'

// After:
import { authLogin, authRegister } from './actions/auth/controller.tsx'
```

Update all route mappings to use the new names.

### Step 7: Delete flat directories and relocate tests

```bash
git rm -r app/actions/auth-login/

# Restore test files to new location:
git show HEAD:app/actions/auth-login/controller.test.ts > app/actions/auth/auth-login.test.ts
```

### Step 8: Extract page components (if applicable)

If controllers have inline page components (common for auth, uncommon for admin), extract them to `pages.tsx`:

```typescript
// controller.tsx:
import { LoginPage } from './pages.tsx'

// pages.tsx:
export function LoginPage(handle: Handle<LoginPageProps>) { ... }
```

UI-only imports (`Handle`, `css`, `theme`, page building blocks) move to `pages.tsx`; business logic imports stay in `controller.tsx`.

### Step 9: Verify

```bash
npm run typecheck    # catches missing imports, wrong type names
npm run lint         # catches const/let issues
npx remix doctor     # confirms warnings silenced
```

## When to Use

- When `remix doctor` produces "does not match any route map" warnings for controllers
- When consolidating feature directories following the timeboxer demo pattern
- When moving from flat kebab-case controller dirs to directory-per-feature layout
- Always pair with `remix-doctor-feature-dir-warnings` skill for understanding the remaining false positives
