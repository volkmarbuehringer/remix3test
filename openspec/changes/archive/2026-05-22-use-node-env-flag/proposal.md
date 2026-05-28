## Why

The app currently uses `process.loadEnvFile('./.env')` as a top-level statement in 4 source files (`server.ts`, `server.new`, `app/data/setup.ts`, `app/middleware/session.ts`) to load environment variables from `.env`. This is repetitive, couples env loading to source code, and means every entry point must remember to include this statement before any env-dependent imports.

Node.js 24.3.0+ (which the project requires via `engines`) ships the `--env-file-if-exists` flag that loads `.env` before any code executes. The timeboxer demo already uses this pattern — it's the cleaner, standard approach.

## What Changes

- Remove `process.loadEnvFile('./.env')` from all 4 source files: `server.ts`, `server.new`, `app/data/setup.ts`, `app/middleware/session.ts`
- Add `--env-file-if-exists=.env` to the `node` invocation in `package.json` scripts (`dev`, `start`)
- No new dependencies. No runtime behavior change. Environment variables are loaded identically, just earlier and automatically.

## Capabilities

### New Capabilities
- `env-loading`: How `.env` files are loaded into `process.env` — moved from inline `process.loadEnvFile()` calls to Node.js's built-in `--env-file-if-exists` CLI flag, managed centrally in `package.json`

### Modified Capabilities

<!-- No existing specs are changing — this is purely an implementation technique change. -->

## Impact

- **Files modified**: `package.json` (scripts), `server.ts`, `server.new`, `app/data/setup.ts`, `app/middleware/session.ts`
- **Dependencies**: None removed or added
- **Runtime behavior**: Identical — `.env` was already loaded before any env-reading code, now it happens even earlier (before any JS executes)
- **Dev experience**: Environment loading is now centralized in `package.json` scripts instead of scattered across entry points
