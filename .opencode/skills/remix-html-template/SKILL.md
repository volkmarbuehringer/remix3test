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
let list = html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>`
let page = html`<!doctype html><html>${title}${list}</html>`
```

Conditionals: use `null`/`undefined` to skip.

## References

- `~/remix/packages/html-template/README.md` — full API docs
