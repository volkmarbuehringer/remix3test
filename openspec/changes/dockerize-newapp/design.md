## Context

The newapp is a Remix 3 application that runs TypeScript directly via `remix/node-tsx` (no build step). It connects to a Neon PostgreSQL database via `pg` with SSL. Currently it's only run in local development. The goal is to package it as a Docker container for deployment on a public Docker host.

The app uses `remix@next` (from npm), `pg` for database access, and has AI SDK dependencies that are omitted at runtime (no AI keys).

## Goals / Non-Goals

**Goals:**
- Produce a working Docker image that starts the app on `http://0.0.0.0:44100`
- Connect to a Neon PostgreSQL database via baked-in `.env` file
- Skip SMTP/AI features (existing users can log in, registration disabled)
- Minimal image size using multi-stage build
- Clean signal handling (SIGTERM/SIGINT) for graceful shutdown in Docker

**Non-Goals:**
- TLS/HTTPS termination (handled by reverse proxy separately if needed)
- SMTP/email configuration (not needed for initial deployment)
- Health checks, logging infrastructure, or monitoring
- CI/CD pipeline
- Secrets management beyond baking `.env` into the image

## Decisions

### Multi-stage build with pnpm
- **Choice**: Builder stage installs deps, runtime stage contains only what's needed
- **Rationale**: Keeps final image lean — devDependencies (Playwright, oxlint, prettier) are excluded. pnpm is not needed in the runtime stage.
- **Alternative considered**: Single-stage build — simpler but includes dev tooling in the image.

### node:26-slim base image
- **Choice**: Official Node 26 slim image
- **Rationale**: Matches the project's `node >=26.2.0` requirement. Slim variant is smaller than full Debian but includes enough for `pg` SSL connections after adding `ca-certificates`.
- **Alternative considered**: `node:26-alpine` — smaller but adds complexity (need build tools for native deps if any; `pg` has C extensions).

### Bake .env into the image
- **Choice**: `COPY . .` includes `.env` with DATABASE_URL and SESSION_SECRET
- **Rationale**: Simplest approach for a single-container deployment with test data. The Neon DB URL is low-risk (test data only).
- **Alternative considered**: Docker secrets or `env_file` in compose — more secure but requires runtime env management. Not needed for this use case.

### Remix from npm (`remix@next`)
- **Choice**: Switch from GitHub URL to npm registry
- **Rationale**: npm install is simpler, faster, and works reliably in Docker without git dependencies. Same package, same exports.
- **Alternative considered**: Keep GitHub URL — works but adds git as a build dependency.

### `CI=true` to skip Playwright postinstall
- **Choice**: Set `CI=true` in builder stage
- **Rationale**: The postinstall script installs Playwright browser binaries (chromium, firefox) which are only needed for E2E tests, not production. `CI=true` skips them entirely.
- **Alternative considered**: `pnpm install --prod` — skips all devDependencies but also skips the postinstall script, which could cause issues if any dependency has a required postinstall.

## Risks / Trade-offs

- **[Secrets in image]** The `.env` file is baked into the image. Anyone with image pull access sees DATABASE_URL and SESSION_SECRET. → Mitigation: The DB contains test data only; SESSION_SECRET would need rotation if the image is shared.
- **[No SMTP]** User registration and password reset will fail because SMTP is not configured. → Mitigation: Existing users can still log in. This is an intentional limitation for the initial deployment.
- **[No AI keys]** AI features will not work. → Mitigation: Routes handle this gracefully (no crashes, features simply don't respond). Verified in current usage.
- **[Port conflicts]** Port 44100 is non-standard. → Mitigation: Configurable via `PORT` env var; use Docker port mapping for the host-facing port.
