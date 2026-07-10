## Why

The project requires `node >= 24.3.0` which ships with `process.loadEnvFile()` — a built-in, zero-dependency alternative to `dotenv`. Removing the `dotenv` dependency reduces install size, avoids unnecessary third-party code, and aligns with Node.js standards.

## What Changes

- Replace `import 'dotenv/config'` with `process.loadEnvFile('./.env')` in all 4 files that currently import dotenv
- Remove `dotenv` from `package.json` dependencies
- Clean up `pnpm-lock.yaml` entries for `dotenv`

## Capabilities

### New Capabilities

- `env-loading`: Specification for how environment variables are loaded at startup — file location, timing, and path resolution

### Modified Capabilities

- _(No existing specs are affected — this is an implementation detail change only)_

## Impact

- **Files modified**: `server.ts`, `server.neu`, `app/middleware/session.ts`, `app/data/setup.ts` — each gets `import 'dotenv/config'` replaced with `process.loadEnvFile('./.env')`
- **File modified**: `package.json` — remove `dotenv` from dependencies
- **File auto-updated**: `pnpm-lock.yaml` — will be cleaned up by `pnpm install`
- **Node version**: no impact (already >= 24.3.0)
- **Runtime behavior**: identical — `process.loadEnvFile()` loads the file and populates `process.env` exactly as `dotenv` does
