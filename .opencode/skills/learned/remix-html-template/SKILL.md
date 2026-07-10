---
name: remix-html-template
description: Use `remix/html-template` for safe HTML template literals with automatic XSS escaping. Activate when generating HTML strings outside the component system — RSS feeds, email bodies, error pages, or inline HTML fragments.
---

# Remix HTML Template

Covers `remix/html-template`.

## Safe HTML

Auto-escapes interpolated values:

```ts
import { html } from 'remix/html-template'

let userInput = '<script>alert("XSS")</script>'
let greeting = html`<h1>Hello ${userInput}!</h1>`
// <h1>Hello &lt;script&gt;alert("XSS")&lt;/script&gt;!</h1>
```

## Raw HTML (Trusted Sources Only)

```ts
let trustedIcon = '<svg>...</svg>'
html.raw`<button>${trustedIcon} Click me</button>`
```

## Composition and Arrays

```ts
let title = html`<h1>Title</h1>`
let list = html`<ul>
  ${items.map((i) => html`<li>${i}</li>`)}
</ul>`
let page = html`<!doctype html>
  <html>
    ${title}${list}
  </html>`
```

Conditionals: use `null`/`undefined` to skip.

## Standalone Error Pages

When returning HTML from `new Response()` (e.g., 500, 429 handlers outside the render pipeline), coerce the tagged template with `String()`:

```ts
import { html } from 'remix/html-template'

return new Response(
  String(
    html`<!doctype html>
      <html lang="de">
        <head>
          <meta charset="utf-8" />
          <title>Serverfehler — newapp</title>
          <style>
            body {
              font-family: 'JetBrains Mono', ui-monospace, monospace;
              background: #f7fbff;
              color: #313539;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
            }
            .card {
              background: #fff;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              text-align: center;
              max-width: 480px;
            }
            h1 {
              font-size: 1.25rem;
              margin: 0 0 0.5rem;
            }
            p {
              color: #5a5e62;
              margin: 0;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Serverfehler</h1>
            <p>Bitte versuchen Sie es später erneut.</p>
          </div>
        </body>
      </html>`,
  ),
  { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
)
```

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

- `~/remix/packages/html-template/README.md` — full API docs
