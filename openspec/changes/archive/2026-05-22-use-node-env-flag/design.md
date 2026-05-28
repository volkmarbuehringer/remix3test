## Context

The app currently has `process.loadEnvFile('./.env')` as the first line in 4 entry modules (`server.ts`, `server.new`, `app/data/setup.ts`, `app/middleware/session.ts`). This was introduced in a previous change to replace the `dotenv` npm package, but it still couples env loading to each source file. Each entry point must independently load the env before any env-dependent imports.

Node.js has supported `--env-file-if-exists` since v23 (stable). The project requires `node >= 24.3.0`. The timeboxer demo already uses this flag in its `package.json` scripts. Moving to the CLI flag makes env loading a deployment concern (handled by the runtime invocation) rather than a code concern.

## Goals / Non-Goals

**Goals:**
- Remove `process.loadEnvFile('./.env')` from all source files
- Add `--env-file-if-exists=.env` to all `node` invocations in `package.json` scripts
- Preserve identical runtime behavior (env vars loaded before any code reads them)

**Non-Goals:**
- No change to which env vars are loaded or how they're used
- No change to the `.env` file format or location
- No change to CI/CD or test runner configuration (tests use `NODE_ENV=test` and don't currently use `--env-file-if-exists`)

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **CLI flag vs process.loadEnvFile** | `--env-file-if-exists` | The flag loads `.env` before any JS executes, so all modules (including imports evaluated at the top level) see env vars. This eliminates the ordering concern that motivated having `loadEnvFile` before imports in every file. It's also the pattern used by the timeboxer demo and the recommended approach for Remix 3 apps. |
| **--env-file-if-exists vs --env-file** | `--env-file-if-exists` | Use the `-if-exists` variant so the app doesn't crash if `.env` is missing (e.g., in production where env vars are set another way). The current `loadEnvFile` code would also crash on a missing file, so this is strictly more robust. |
| **Which scripts to modify** | `dev`, `start` | These are the only scripts that invoke `node` directly. The `test` and `typecheck` scripts use `remix test` and `tsc` respectively — those don't pass through to our `node`. |
| **Remove from all 4 files** | Yes | Clean sweep. Once the flag is in `package.json`, the inline calls are redundant. Leaving them in some files would be confusing and defeat the purpose of centralization. |

## Risks / Trade-offs

- **[Low] Test isolation**: Tests that read `.env` won't get it from the `--env-file-if-exists` flag (tests run via `remix test`, not `node`). However, this is the same as today — `process.loadEnvFile` in the source files only runs when those modules are executed, and test setup handles env separately.
- **[Low] Missing `.env` in development**: If a developer deletes `.env`, the `-if-exists` flag silently skips it. The `process.loadEnvFile` currently would throw. This is strictly better (non-breaking) but could mask a missing config. Mitigation: the app will fail at the first actual use of an expected env var, so the error is still clear.
- **[None] Compatibility**: `--env-file-if-exists` is available in all Node.js versions the project supports (>=24.3.0).
