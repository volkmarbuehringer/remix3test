## Context

Two files return plain-text error responses that users see in the browser:

- `server.ts:22` — catch-all 500 when an unhandled error escapes the router
- `app/middleware/global-rate-limit.ts:44` — 429 when an IP exceeds the rate limit

Both run before or outside the React component/render pipeline, so `context.render()` is unavailable. The app already uses `remix/html-template` with the `String(html\`...\`)` coercion pattern in `auth.ts`, `render.tsx`, and `send-email.ts` for the same kind of server-side HTML generation.

## Goals / Non-Goals

**Goals:**
- Replace plain-text 500 and 429 responses with styled HTML pages
- Match the app's visual identity (JetBrains Mono font, cool gray palette, rounded card, German language)
- Use the same `import { html } from 'remix/html-template'` pattern already established
- Keep the 500 page minimal (crash-all handler must not introduce failure modes)
- Include `retryAfter` in the 429 page body for user visibility

**Non-Goals:**
- Not adding dark mode support to these pages (they're server-level, no theme context)
- Not converting the 12+ controller-level plain-text error responses (low ROI, edge-case paths)
- Not adding new dependencies
- Not changing status codes, headers, or behavior beyond the response body

## Decisions

### 1. Full HTML documents with inline CSS (not fragments)

**Decision:** Both pages will emit complete `<!doctype html>` documents with inline `<style>` blocks, not bare `<div>` fragments like the 401 frame response in `auth.ts`.

**Rationale:** The 401 frame response works as a fragment because it's rendered inside the frame container of an existing page shell. The 500 and 429 responses are top-level — there's no wrapping layout. The browser receives them directly, so they need a full document.

**Alternative considered:** Return a fragment and let the client-side entry.tsx handle it. Rejected because the error may occur before the client-side JS loads (500) or during heavy load (429).

### 2. Hardcoded theme values (not CSS custom properties)

**Decision:** Use hardcoded hex color values in the inline `<style>`, matching the app's light-mode theme tokens.

**Rationale:** These pages don't have access to the theme contract (`--rmx-*` CSS custom properties) because they're rendered outside the component system where `<Theme />` injects the variables. They also don't need dark-mode support — they're transient error states.

### 3. Minimal 500, richer 429

**Decision:** The 500 page will have just a heading and short message (safe under crash conditions). The 429 page will include the dynamic `retryAfter` value and a more explanatory message.

**Rationale:** The 500 catch-all in `server.ts` must not introduce its own failure modes — if the error was caused by a module load failure, even importing `html` could cascade. In practice, the import is at module scope, so it's safe. But keeping the 500 minimal is a defense-in-depth principle.

### 4. Patterns established in auth.ts

**Decision:** Follow the existing pattern:
```ts
import { html } from 'remix/html-template'
// ...
return new Response(String(html`<html lang="de">...</html>`), { status: 500, headers })
```

**Rationale:** Three files already use this exact pattern. No need to invent a new approach.

## Risks / Trade-offs

- **500 page failure cascade** → If importing `remix/html-template` itself throws, the 500 handler would crash before sending a response (the original error would be lost). Mitigation: import is at module scope, so it would fail at startup, not during a request. The app wouldn't start at all, which is detectable immediately.
- **No dark mode** → Users in dark mode seeing a light-themed error page. Acceptable trade-off — these are transient error states.
- **Inline CSS duplication** → Hardcoded colors create a maintenance point if the theme changes. Acceptable — the theme is stable, and these are error pages that rarely change.
- **Content-Type header** → Must change from `text/plain` to `text/html` for the browser to render the HTML. Already handled for 429 (currently `text/plain` — needs changing). For 500, adding headers is new (currently just `new Response('...', { status: 500 })` with no Content-Type).
