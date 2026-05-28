<!-- Context: remix3/guides/project-layout | Priority: high | Version: 1.2 | Updated: 2026-05-01 -->

# Guide: Remix Project Layout

**Core Concept**: Canonical on-disk layout for Remix applications with clear route ownership and placement precedence.

## Key Points

**Root directories**:
- `app/` runtime code, `db/` migrations/SQLite, `public/` static files, `test/` helpers, `tmp/` scratch

**App organization**:
- `app/assets/` client entrypoints
- `app/actions/` route handlers and route-local UI
- `app/data/` schema, queries, persistence
- `app/middleware/` auth, sessions, DB injection
- `app/ui/` shared cross-route UI primitives
- `app/utils/` cross-layer helpers
- `app/routes.ts` route contract
- `app/router.ts` router setup

**Route ownership** (per `remix doctor` validation):

| Route Type | Syntax        | Disk Pattern                           | Export     |
|------------|---------------|----------------------------------------|------------|
| **Flat**   | `get(path)` / `post(path)` | `app/actions/{kebab-name}.tsx`     | Named      |
| **Dir**    | `form(path)`  | `app/actions/{kebab-name}/controller.tsx` | Default    |

The camelCase route key is converted to kebab-case via **`toDiskSegment()`** (splits on uppercase boundaries, lowercases). For example, `authLogin` → `auth-login`.

**Promotion rule**: Use flat file for simple `get()`/`post()` routes; promote to directory `controller.tsx` for `form()` routes or when the route grows child modules.

## Naming Conventions

| File | Usage |
|------|-------|
| `controller.tsx` | Controller entrypoints |
| `page.tsx` | Single controller-owned page |
| `index-page.tsx`, `show-page.tsx`, `edit-page.tsx`, `form.tsx` | Resource-style controller UI |
| Flat actions: `home.tsx`, `about.tsx`, `search.tsx` | Leaf route handlers |
| Colocated tests: `home.test.ts`, `controller.test.ts` | Route owner tests |

## Bootstrap

Scaffold new app:
```sh
node skills/remix-project-layout/scripts/bootstrap_remix_application.ts <target-dir>
```

Flags:
- `--app-name <name>` - Override generated app name
- `--remix-version <version>` - Override default remix version
- `--force` - Write into non-empty target directory

## Anti-Patterns

- No `app/lib/` generic dumping ground
- No `app/components/` when `app/ui/` exists
- No shared UI in `app/actions/`
- No vague files like `helpers.ts`, `common.ts`
- No middleware/session/auth in `app/utils/`
- No schema/query/DB setup in `app/utils/`

## Reference

- Full skill: `~/remix/skills/remix-project-layout/SKILL.md`
- Routing: `../concepts/routing.md`
- Shared UI: `ui/navigation.md`