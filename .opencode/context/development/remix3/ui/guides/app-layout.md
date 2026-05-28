<!-- Context: development/remix3/guides/app-layout | Priority: high | Version: 1.1 | Updated: 2026-05-01 -->

# Remix Application Layout

Canonical directory structure for Remix applications following remix-application-layout skill.

## Core Concept

Organize code by responsibility: `actions/` for routes, `data/` for schemas/queries, `middleware/` for request lifecycle, `ui/` for shared components.

## Root Directories

```
<app>/
├── app/              # Runtime application code
├── db/               # Database artifacts (SQLite, migrations)
├── public/           # Static files
├── test/              # Shared test helpers
└── tmp/              # Runtime scratch (uploads, caches)
```

## App Structure

```
app/
├── actions/          # Route handlers + local UI
│   ├── controller.tsx         # Root: top-level Route leaves
│   ├── home.tsx               # Flat: get()/post() routes (named export)
│   ├── contact/
│   │   └── controller.tsx     # Directory: form() routes (default export)
│   ├── login/
│   │   └── controller.tsx     # Directory: form() routes (default export)
│   └── logout.tsx              # Flat: post() routes (named export)
├── data/             # Schema, queries, persistence setup
├── middleware/       # Auth, sessions, database injection
├── ui/              # Shared cross-route UI
│   ├── layout.tsx
│   ├── document.tsx
│   └── form-field.tsx
├── utils/           # Cross-layer helpers
├── routes.ts         # Route contract
└── router.ts        # Router setup
```

## Placement Precedence

1. Narrowest owner first
2. One route → keep with that route
3. Cross-route UI → `app/ui/`
4. Request lifecycle → `app/middleware/`
5. Schema/queries → `app/data/`
6. Genuinely cross-layer → `app/utils/`

## Route Ownership

The `remix doctor` CLI validates file placement using `toDiskSegment()`:

| Route Type | Syntax        | Disk Pattern                           | Export     |
|------------|---------------|----------------------------------------|------------|
| **Flat**   | `get(path)` / `post(path)` | `actions/{kebab-name}.tsx`         | Named      |
| **Dir**    | `form(path)`  | `actions/{kebab-name}/controller.tsx` | Default    |

`toDiskSegment()` converts camelCase routes to kebab-case: `authLogin` → `actions/auth-login/`. For `form()` routes, the kebab-segment becomes a directory with `controller.tsx` inside.

## Naming Conventions

- `controller.tsx` - Controller entrypoint
- `page.tsx` - Route-owned page module
- `form.tsx` - Resource-style form UI
- `index-page.tsx`, `show-page.tsx` - Named pages

## Anti-Patterns

❌ Don't create `app/lib/` dumping ground
❌ Don't duplicate `app/ui/` as `app/components/`
❌ Don't put shared UI in `app/actions/`
❌ Don't put middleware in `app/utils/`
❌ Don't create `helpers.ts` or `misc.ts`

## Bootstrap Script

```bash
node skills/remix-project-layout/scripts/bootstrap_remix_application.ts <target-dir>
```

Options:

- `--app-name <name>` - Override app name
- `--remix-version <version>` - Override default version
- `--force` - Write to non-empty directory

## Key Points

- Route key → disk via `toDiskSegment()` (camelCase → kebab-case)
- `get()`/`post()` routes → flat files; `form()` routes → directory + `controller.tsx`
- Keep route-local UI next to owning route
- Shared UI belongs in `app/ui/`, not `actions/`

## 📂 Codebase References

- `demos/bookstore/app/` - Full example app
- `demos/frame-navigation/app/` - Complex routing example
- `skills/remix-project-layout/SKILL.md` - Full skill guide

## Related

- `guides/database-initialization.md` - SQLite patterns
- `guides/split-controllers.md` - Controller organization
