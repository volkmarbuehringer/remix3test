## Why

Two server-level error responses (`server.ts` catch-all 500 and `global-rate-limit.ts` 429) return bare plain text. This is a poor user experience — the browser shows raw text like "Internal Server Error" instead of a styled page with the app's branding, German-language messaging, and useful context. The `remix/html-template` package is already used elsewhere in the app (email bodies, auth middleware) and is the correct tool for safe HTML generation outside the component system.

## What Changes

- Replace the plain-text 500 response in `server.ts` with a styled HTML error page using `remix/html-template`
- Replace the plain-text 429 response in `global-rate-limit.ts` with a styled HTML error page that includes the retry-after duration, using `remix/html-template`
- Both pages will use the app's visual identity (JetBrains Mono font, cool gray palette, rounded cards) and German language

## Capabilities

### New Capabilities
- `error-page-styling`: Styled HTML error pages for server-level error responses (500, 429) generated via `remix/html-template`, providing a consistent branded experience even when the React render pipeline is unavailable.

### Modified Capabilities

<!-- No existing spec-level behavior changes -->

## Impact

- `server.ts` — add import, replace `new Response('Internal Server Error', ...)` with `String(html\`...\`)`
- `app/middleware/global-rate-limit.ts` — add import, replace `new Response('Too Many Requests', ...)` with `String(html\`...\`)`, include `retryAfter` in the page body
- No new dependencies — `remix/html-template` is already in the package
- No API or route changes
