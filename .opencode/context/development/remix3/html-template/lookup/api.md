<!-- Context: remix3/html-template/lookup | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# API Reference

**Import**: `import { html, isSafeHtml } from 'remix/html-template'`

## Exports

| Export | Kind | Description |
|--------|------|-------------|
| `html` | Tagged template fn | Auto-escapes interpolations, returns `SafeHtml` |
| `html.raw` | Tagged template fn | Passthrough without escaping, returns `SafeHtml` |
| `isSafeHtml` | Type guard | `(value: unknown) => value is SafeHtml` |
| `SafeHtml` | Branded type | `String & { readonly [kSafeHtml]: true }` |

## Interpolation Type

```ts
type Interpolation =
  | SafeHtml | string | number | boolean
  | null | undefined
  | Array<Interpolation>
```

## Escape Map

| Input | Output |
|-------|--------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#39;` |

## Behavior Matrix

| Interpolation | `html` | `html.raw` |
|--------------|--------|------------|
| SafeHtml | String(value) | String(value) |
| string | EscapeHtml | Passthrough |
| number | EscapeHtml(String) | String(value) |
| boolean | EscapeHtml(String) | String(value) |
| null/undefined | `''` | `''` |
| Array | Recursive join | Recursive join |

## Related

- `concepts/safe-html.md` — Branding mechanics
- `concepts/escaping-model.md` — Two-tier escaping rules
- `examples/template-usage.md` — Usage in context
