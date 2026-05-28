<!-- Context: development/remix3/packages/concepts | Priority: high | Version: 1.0 | Updated: 2026-04-02 -->

# Concept: HTML Template

**Purpose**: Safe HTML template literals with automatic escaping. Prevents XSS while supporting trusted HTML insertion.

**Key Points**:
- Automatic HTML escaping of interpolated values
- `html.raw` for trusted unescaped content
- SafeHtml values composable without double-escaping
- Full TypeScript support with branded types
- Zero dependencies, runtime agnostic (Node, Bun, Deno, Workers)

**Minimal Example**:
```ts
import { html } from 'remix/html-template'

let userInput = '<script>alert(1)</script>'
let greeting = html`<h1>Hello ${userInput}!</h1>`
// Output: <h1>Hello &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;!</h1>

// Trusted content
let icon = '<svg>...</svg>'
let button = html.raw`<button>${icon} Click</button>`
```

**Reference**: https://github.com/remix-run/remix/tree/main/packages/html-template