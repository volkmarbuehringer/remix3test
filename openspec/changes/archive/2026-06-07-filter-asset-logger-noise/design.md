## Context

Current `logger()` middleware in `app/middleware/root.ts` logs every request including every `/assets/` JS module request. A single page load generates 50-100 asset log lines, making real request logs hard to spot.

## Goals / Non-Goals

**Goals:**

- Suppress log lines for `/assets/` requests with status < 400
- Keep logging `/assets/` errors (status >= 400)
- Keep logging all non-asset requests unchanged
- Single file change, minimal diff

**Non-Goals:**

- Configurable filter patterns (hardcoded to `/assets/` prefix)
- Log level changes
- Performance optimization of asset serving

## Decisions

- **Inline middleware wrapper** — Replace the `logger()` call with a custom middleware that calls the real logger conditionally. No new file, no abstraction.
- **Status threshold** — `< 400` means 2xx/3xx are suppressed, 4xx/5xx are logged. 3xx redirects for assets are unusual but harmless to suppress.
- **Path check** — `context.url.pathname.startsWith('/assets/')` — simple, matches the asset server's `basePath`.

## Risks / Trade-offs

- [Missed debugging] If an asset 404 is intermittent, you won't see it in logs unless you specifically check. Mitigation: 404s are logged (status >= 400).
- [Blindness to slow assets] A slow asset load (200, but 5s) won't be logged. Mitigation: asset timing is visible in browser DevTools, not server logs.
