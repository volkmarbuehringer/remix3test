## Context

newapp's `app/actions/` directory currently holds ~30 flat controller files with long hyphenated names (e.g., `admin-appointments-controller.tsx`). Tests for these controllers live alongside them as separate files (`*.test.ts`, `*.test.tsx`), as do some page components (`lists-show-page.tsx`). Two feature directories already exist: `client/` and `nutzer/`, each containing `controller.tsx` with tests and pages colocated. The `app/router.ts` imports all controllers by file path and maps them to named route trees defined in `app/routes.ts`.

The timeboxer demo project at `~/remix/demos/timeboxer/app/controllers/auth/` demonstrates the target pattern: `controller.tsx` + `pages.tsx` + `controller.test.ts` in one directory.

## Goals / Non-Goals

**Goals:**
- Move every flat controller into a feature directory named after the controller (stripping `-controller` suffix)
- Rename each moved controller file to `controller.tsx`
- Move associated test files and page components into the same feature directory
- Preserve all existing behavior — no route, render, or API changes
- Use `git mv` to preserve file history
- All tests pass and typecheck succeeds after migration

**Non-Goals:**
- Refactoring controller internals, route definitions, or test logic
- Changing the `client/` or `nutzer/` directories (already feature-dir)
- Adding new features or capabilities
- Changing import conventions (still use TS relative imports)
- Consolidating or splitting controllers

## Decisions

### Decision 1: One directory per feature, `controller.tsx` as canonical name

**Rationale:** Matches the established `client/` and `nutzer/` patterns. Predictable — every feature directory has the same entry point name. Eliminates the need for the `-controller` suffix in filenames since the directory provides namespacing.

**Alternatives considered:**
- Keep hyphenated names inside feature dirs (e.g., `admin-appointments/controller.tsx` — already the chosen approach, just stripping the hyphenated suffix)
- Use index.ts exports (creates barrel file overhead and import ambiguity)

### Decision 2: `git mv` for all file moves

**Rationale:** Preserves `git blame` continuity and file history. Standard practice for pure-rename refactors.

**Alternatives considered:**
- Copy-then-delete (loses history, no benefit)

### Decision 3: Batch migration by controller group

**Rationale:** Reduces risk by keeping each batch independently verifiable (typecheck + tests pass). Order: simplest first (few files, few tests) → admin group (largest) → auth → AI → standalone.

**Batch order:**
1. **Simple standalone**: `controller.tsx` (home/UI showcase), `lists-controller` + `lists-show-page`, `verwaltung-controller`
2. **Admin controllers**: admin-appointments, admin-chatlog, admin-chatlog-fragments, admin-fragments, admin-lists, admin-messages, admin-offering-configs, admin-offerings, admin-resources, admin-users, admin-controller
3. **Auth controllers**: auth-login, auth-register, auth-logout
4. **AI controllers**: ai-controller, ai-fragments-controller, agent-controller, chat-controller, workflow-controller
5. **Remaining**: appointtype-controller, appointment-controller

### Decision 4: Page component naming

**Rationale:** For features with a single page, use `page.tsx`. For features with multiple pages (e.g., `lists-show-page.tsx`), preserve distinct names like `show-page.tsx` inside the directory. This matches `client/` which uses `create-page.tsx`, `edit-page.tsx`, `grid-page.tsx`.

### Decision 5: Top-level `controller.tsx` stays as home controller

**Rationale:** The existing `controller.tsx` at the top of `app/actions/` is the home/assets/ui-showcase controller. It moves to `app/actions/home/controller.tsx` to fit the pattern.

## Risks / Trade-offs

- **[Risk] Broken import paths in `app/router.ts`** → Mitigation: Update all 26 import lines in a single commit after each batch; typecheck catches misses immediately.
- **[Risk] Test file references break** → Mitigation: Test files use relative imports or module imports that resolve identically after the move since they move with their controller.
- **[Risk] Large diff in git history** → Mitigation: Pure renames via `git mv` minimize diff noise; `git log --follow` still works.
- **[Risk] Merge conflicts with ongoing feature branches** → Mitigation: Complete migration as a single atomic change; communicate timing to team.
