## Context

The project currently uses the `dotenv` npm package to load environment variables from `.env` at project root via `import 'dotenv/config'` in 4 entry files. Node.js 24.3.0+ ships `process.loadEnvFile(path)` as a stable, zero-dependency alternative. The project's `engines` field requires `node >= 24.3.0` and the active runtime is v25.9.0.

The `.env` file lives at the project root and stays there.

## Goals / Non-Goals

**Goals:**

- Replace `import 'dotenv/config'` with `process.loadEnvFile('./.env')` in all entry modules
- Remove `dotenv` from `package.json` dependencies
- Clean up `pnpm-lock.yaml`
- Preserve identical runtime behavior

**Non-Goals:**

- No changes to which environment variables are used or their values
- No changes to schema validation or env var defaults
- No introduction of `.env.local`, `.env.production`, or other multi-env patterns
- No changes to the database, session, or any other runtime logic

## Decisions

| Decision                             | Choice                                                   | Rationale                                                                                                                                                                                                            |
| ------------------------------------ | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Which module calls `loadEnvFile`** | Each entry module that currently imports `dotenv/config` | `loadEnvFile` is a side effect (loads env into `process.env`), the same as `import 'dotenv/config'`. Placing it in each entry file preserves the existing pattern where every entry point is independently runnable. |
| **File path**                        | `./.env`                                                 | Keeps `.env` at the project root, unchanged from current location. Relative path resolves from `process.cwd()` which is the project root during normal `npm start` / `tsx server.ts` usage.                          |
| **Timing**                           | Called before any module that reads `process.env`        | Same as current — the `import 'dotenv/config'` runs at module evaluation time. `loadEnvFile` will be the first executable statement in each entry file.                                                              |

## Risks / Trade-offs

- **[Low] Relative path assumption**: `process.loadEnvFile('./.env')` resolves relative to `process.cwd()`. If the app is ever launched from a different working directory, the path won't resolve. The same issue exists with the current `dotenv` config (it resolves from CWD by default). Mitigation: use `import.meta.resolve` or `path.resolve(dirname, ...)` if this becomes an issue.
- **[Low] No unload capability**: `dotenv` doesn't offer unload either, so no regression.
- **[Low] Lockfile diff**: `pnpm install` after removing the dependency will regenerate `pnpm-lock.yaml`. This is expected and safe.
