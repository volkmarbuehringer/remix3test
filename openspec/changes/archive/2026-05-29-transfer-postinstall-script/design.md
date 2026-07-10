## Context

The newapp project uses Playwright for browser-based testing (`@playwright/test` and `playwright` in devDependencies), but has no automated mechanism to install Playwright browsers. Currently, a developer must run `npx playwright install` manually after `pnpm install`. The Remix monorepo has a production-tested postinstall script that installs Playwright browsers with retry logic, timeout protection, signal handling, and partial-install cleanup.

The previous postinstall (oxlint bindings + node-tsx patch) has been removed as it is no longer needed. The Playwright postinstall will be the only postinstall step.

## Goals / Non-Goals

**Goals:**

- Automatically install Playwright browsers (chromium, firefox) on `pnpm install`
- Use `--only-shell` flag to minimize download size (enough for test runner, no GUI needed)
- Include retry logic: if installation fails, clean up partial installs and retry once
- Handle process signals (SIGINT, SIGTERM, SIGHUP) to kill child processes cleanly
- Timeout after 5 minutes to prevent hung CI jobs
- Skip installation entirely when `CI` environment variable is set (CI manages browsers separately)

**Non-Goals:**

- Not adding Playwright to dependencies (already present)
- Not modifying test configuration or adding new test infrastructure
- Not installing webkit or other browsers not needed by the project
- Not changing how existing postinstall scripts work for other projects in the monorepo

## Decisions

1. **Adapt, don't fork** — The Remix script targets `@remix-run/ui` Playwright paths. For newapp, the script will be adapted to use the newapp project's own Playwright CLI path (`node_modules/playwright/cli.js`) and working directory (project root). This keeps the logic identical while changing only the paths.

2. **Use Node.js built-in APIs only** — The original script uses `node:child_process`, `node:fs`, `node:path`, `node:url`. No external dependencies. This is correct for a postinstall script that must work before any `node_modules` are fully resolved.

3. **Single postinstall script** — The old postinstall steps are gone. The new `postinstall.ts` will be the sole postinstall entry point. No merging needed.

## Risks / Trade-offs

- **Risk: Playwright CLI path changes with version updates** → The script uses a relative path into `node_modules` which is version-dependent. If Playwright updates change the CLI location, the path needs updating. Mitigation: use a glob or resolve via Playwright's package.json `bin` field.
- **Risk: Installation takes time (5 min timeout)** → This only runs on fresh installs or after `node_modules` is wiped. Subsequent `pnpm install` calls are fast since Playwright checks `INSTALLATION_COMPLETE` files.
- **Risk: CI skip logic hides failures** → CI systems typically manage browsers themselves. The `CI` env var skip is intentional and matches the Remix pattern.
