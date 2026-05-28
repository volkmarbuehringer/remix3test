## Context

Three middleware files in `app/middleware/` construct HTML strings without going through Remix's component rendering pipeline (`remix/ui/server`). These are boundary/error responses that fire outside normal page rendering:

- `admin.ts` — 403 Forbidden page with inline CSS, returned when a non-admin user accesses admin routes
- `auth.ts` — 401 Unauthorized HTML fragment returned for frame-level auth failures
- `render.tsx` — `<pre>Frame error</pre>` fallback when a frame subrequest fails

All three currently use plain template literals. Values are interpolated directly without escaping. While the current interpolations are safe (HTTP status codes, `response.statusText`), the pattern is a maintenance hazard — any future change that introduces dynamic content into these strings could create an XSS vector.

`remix/html-template` (imported as `import { html } from 'remix/html-template'`) is already available as a transitive dependency of the `remix` package. It provides a tagged template function that auto-escapes interpolated values and supports explicit trusted-HTML insertion via `html.raw`.

## Goals / Non-Goals

**Goals:**
- Replace raw HTML template literals with `html` tagged templates in all three middleware files
- Ensure all HTML generated outside the component pipeline is auto-escaped
- Keep the refactor purely mechanical — no behavioral changes to HTTP responses

**Non-Goals:**
- Migrating error pages to use Remix's JSX component system (they're intentionally outside the render pipeline because they fire before or independent of page rendering)
- Changing CSS, layout, or content of the error responses
- Adding the `remix` dependency (already present)
- Adding new test coverage (existing tests cover the response behavior)
- Migrating any other files — scope is strictly the three identified middleware files

## Decisions

### Decision 1: Use `String(html\`...\`)` instead of passing `html\`...\`` directly

**Chosen:** Explicitly convert `SafeHtml` to string via `String()` in the `Response` constructor.

**Rationale:** Both `new Response(String(html\`...\`), ...)` and `new Response(html\`...\`, ...)` work — `SafeHtml` has a `toString()` that returns the escaped string. Using `String()` explicitly is clearer for readers who may not know `SafeHtml` is a `Stringifiable` type, and it avoids any ambiguity about what `Response` does with the value.

**Alternatives considered:**
- Passing `SafeHtml` directly to `Response` — works but relies on implicit `toString()`, making the code harder to follow at a glance.

### Decision 2: Keep the 403 page as a literal template instead of extracting to a component

**Chosen:** Keep the HTML inline as a template, wrapped in `html\`...\``.

**Rationale:** The 403 page content is static (a single page with no dynamic data). Extracting it to its own file or component would add indirection without benefit. The template is short enough (~18 lines) to remain readable inline.

### Decision 3: Use `html.raw` only when deliberately injecting trusted HTML

**Chosen:** None of the three locations need `html.raw`. All interpolations are plain strings that should be escaped.

**Rationale:** `html.raw` bypasses the auto-escaper. None of the current strings contain pre-escaped HTML that needs passthrough. This keeps the code maximally safe.

## Risks / Trade-offs

- **[Low] Accidental double-escaping** — If a value that is already HTML is passed through the template, it will be escaped (rendering as literal `<` instead of a tag). This is by design and is the safe default. If a future change intentionally needs raw HTML, `html.raw` is the explicit opt-in.
- **[Low] Developer unfamiliarity** — Team members may not know `remix/html-template` exists. The skill file (`.agents/skills/remix/SKILL.md`) already references it, and this change makes it a live, visible pattern in the codebase — future contributors will see it used and follow suit.
- **[None] No migration/rollback concern** — The change is small and mechanical. Reverting is a single-file-per-location undo.
