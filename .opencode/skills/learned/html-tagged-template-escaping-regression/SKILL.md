---
name: html-tagged-template-escaping-regression
description: "When refactoring from auto-escaping tagged template literals to plain string interpolation, you lose XSS protection — add manual escaping."
user-invocable: false
origin: auto-extracted
---

# HTML Tagged Template Escaping Regression

**Extracted:** 2026-06-16
**Context:** Refactoring email templates from `html\`...\`` (auto-escaping) to locale string functions with plain interpolation

## Problem

Tagged template literals like `remix/html-template`'s `html\`...\`` auto-escape interpolated values:

```ts
import { html } from 'remix/html-template'
let htmlBody = String(html`<p>Hallo ${userName}</p>`)
// userName = '<b>Max</b>' → outputs: <p>Hallo &lt;b&gt;Max&lt;/b&gt;</p>
```

When you refactor away from the tagged template to plain string interpolation (array `.join()`, `+` concatenation, or raw template literals), you silently lose this auto-escaping. The same user name now injects raw HTML:

```ts
let htmlBody = `<p>Hallo ${userName}</p>`
// userName = '<b>Max</b>' → outputs: <p>Hallo <b>Max</b></p>  ← XSS vector
```

This is a defense-in-depth regression — the old code was safe, the new code is not.

## Solution

Add a minimal HTML escape helper and wrap every user-supplied value in HTML-producing functions:

```ts
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
```

Use it for every interpolated value in HTML context:

```ts
// BEFORE (unsafe)
`<p>Hallo ${name},</p>`

// AFTER (safe)
`<p>Hallo ${esc(name)},</p>`
```

Plain-text versions (email text bodies, log messages) don't need escaping — HTML entities are meaningless outside HTML context.

## When to Use

- Refactoring from `html\`...\`` (remix/html-template), `html\`...\`` (lit-html), or any auto-escaping tagged template to plain string building
- Extracting locale/message strings that contain HTML tags and dynamic values
- Creating new HTML-generating helper functions outside a framework's template system
- Code review: flag when `html` tagged template is removed but values are still interpolated into HTML strings
