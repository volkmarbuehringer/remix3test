## Why

The newapp project currently runs only in local development mode. Dockerizing it enables deployment on a public Docker host with a connection to a Neon PostgreSQL database, making the application publicly accessible.

## What Changes

- Switch `remix` dependency from GitHub preview to `remix@next` from npm registry
- Add `Dockerfile` with multi-stage build for container packaging
- Add `.dockerignore` to keep the container image lean
- Add `docker-compose.yml` for one-command deployment on the Docker host

## Capabilities

### New Capabilities

- `container-deployment`: Docker container build, configuration, and deployment for running newapp on a public Docker host with Neon database connectivity

### Modified Capabilities

(none)

## Impact

- `package.json`: remix dependency changes from GitHub URL to `"remix": "next"`
- New files: `Dockerfile`, `.dockerignore`, `docker-compose.yml`
- Existing `.env` file is baked into the Docker image (contains only Neon DB URL and SESSION_SECRET)
- No Application code changes required
