<!-- Context: remix3/html-template/concepts | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# SafeHtml Branded Type

**Core Idea**: A branded `String` subtype that marks HTML strings as safe to render without escaping. The brand uses a `unique symbol` intersection type — a zero-runtime-cost tag in TypeScript that carries a runtime symbol check.

## How the Brand Works

```ts
const kSafeHtml: unique symbol = Symbol('safeHtml')
export type SafeHtml = String & { readonly [kSafeHtml]: true }
```

- `unique symbol` ensures the brand is unspoofable from outside the module
- Values are created via `new String(value)` (object wrapper), allowing the symbol property to be attached
- `String()` coercion on SafeHtml values returns the inner HTML string

## Key Points

- **No runtime overhead** beyond the symbol property assignment — no class, no prototype chain
- **`isSafeHtml(value)`** type guard checks `typeof value === 'object'` (string objects are typeof 'object') + the symbol key presence
- **Nesting aware**: `html` and `html.raw` both unwrap SafeHtml via `String(value)` without re-escaping — fragments compose safely
- **Forward compatible**: Any value tagged with the same symbol (even from another module instance) is treated as safe

## Reference

- Source: `src/lib/safe-html.ts` lines 1-23
- `isSafeHtml` used in both `stringifyInterpolation` and `stringifyRawInterpolation`

## Related

- `concepts/escaping-model.md` — How SafeHtml interacts with the two-tier escape model
- `lookup/api.md` — Export reference
