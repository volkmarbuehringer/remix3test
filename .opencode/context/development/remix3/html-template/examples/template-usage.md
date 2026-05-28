<!-- Context: remix3/html-template/examples | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Template Usage Examples

## Basic Escaping

```ts
import { html } from 'remix/html-template'

let escaped = html`<h1>${'<script>alert(1)</script>'}</h1>`
String(escaped)
// → '<h1>&lt;script&gt;alert(1)&lt;/script&gt;</h1>'

let withAttr = html`<input value="${'hello & welcome'}" />`
String(withAttr)
// → '<input value="hello &amp; welcome" />'
```

## Raw HTML from Trusted Sources

```ts
let icon = '<svg aria-label="Icon"><circle cx="5" cy="5" r="5"/></svg>'
let button = html.raw`<button>${icon} Click me</button>`
// ⚠️ Only use html.raw with content you control
```

## Composing SafeHtml Fragments

SafeHtml values nest without double-escaping:

```ts
let title = html`<h1>My Title</h1>`
let body = html`<p>Welcome, ${userName}!</p>`
let page = html`<html><body>${title}${body}</body></html>`
// SafeHtml unwrapped — no re-escaping
```

## Nested Arrays + Conditionals

```ts
import { html } from 'remix/html-template'

// Array flattening — map to SafeHtml fragments
let items = ['Apple', 'Banana', 'Cherry']
let list = html`<ul>
  ${items.map(item => html`<li>${item}</li>`)}
</ul>`

// Conditional rendering via null/undefined
let showError = false
let msg = 'Something went wrong'
let page = html`<div>
  ${showError ? html`<div class="error">${msg}</div>` : null}
</div>`

// Array + conditional
let rows = data.length > 0
  ? data.map(r => html`<tr><td>${r.name}</td></tr>`)
  : html`<tr><td>No data</td></tr>`
```

## Type Guard

```ts
import { html, isSafeHtml } from 'remix/html-template'

let safe = html`<p>Hello</p>`
isSafeHtml(safe)          // → true
isSafeHtml('<p>Hello</p>') // → false (plain string)
```

## Related

- `concepts/escaping-model.md` — Detailed escaping rules
- `concepts/safe-html.md` — Branded type mechanics
- `lookup/api.md` — Full API reference
