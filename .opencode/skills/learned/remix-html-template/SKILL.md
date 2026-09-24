---
name: remix-html-template
description: "Use when generating HTML strings outside the component system (RSS, email, error pages) — `remix/html-template` gives safe literals with automatic XSS escaping."
---

# Remix HTML Template

Covers `remix/html-template`.

For the safe-HTML tagged-template API (`html\`...\`` auto-escaping, `html.raw` for trusted sources, composition/arrays, conditional `null`/`undefined`), see `node_modules/remix/src/html-template/README.md`.

## Standalone Error Pages

When returning HTML from `new Response()` (e.g., 500, 429 handlers outside the render pipeline), coerce the tagged template with `String()`:

```ts
import { html } from 'remix/html-template'

return new Response(
  String(html`<!doctype html><html lang="de"><head>...</head><body>...</body></html>`),
  { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
)
```

The live 500 handler is `app/utils/server-handler.ts:25` (the `catch` in the request listener) — mirror it when adding sibling error pages.

### Full document vs fragment

- **Top-level responses** (500, 429): emit a complete `<!doctype html>` document with inline `<style>` — there's no wrapping layout
- **Frame responses** (e.g., 401 in `auth.ts`): emit a bare `<div>` fragment — the frame container provides the shell
- Both use `String(html\`...\`)`to get a plain string for the`Response` body

### Inline CSS with hardcoded theme values

Outside the component system, CSS custom properties (`--rmx-*`) and `css()` mixins are unavailable. Use hardcoded hex values matching the app's light-mode theme. Dark mode is not needed for transient error pages.

### Keep crash-all handlers minimal

For the outermost 500 handler in `server.ts`, use minimal HTML (static content, no dynamic interpolation) to avoid cascading failures if the error originates in the module system.

## Caveats: Don't Lose XSS Escaping on Refactor

When you refactor away from the `html` tagged template to plain string interpolation (array `.join()`, `+` concatenation, or raw template literals), you **silently lose auto-escaping**:

```ts
// BEFORE — safe (auto-escaped via tagged template)
String(html`<p>Hallo ${userName}</p>`)
// AFTER — unsafe (plain interpolation, XSS vector)
`<p>Hallo ${userName}</p>`
```

If you must move to plain strings, add a manual escape helper and wrap every interpolated value:

```ts
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Now safe
;`<p>Hallo ${esc(userName)},</p>`
```

This is most commonly encountered when extracting template strings into locale/i18n message functions. Code review should flag when `html` tagged template is removed but values are still interpolated into HTML strings.

## References

- `node_modules/remix/src/html-template/README.md` — full API docs
- `app/utils/server-handler.ts:25` — the live 500 handler in this repo