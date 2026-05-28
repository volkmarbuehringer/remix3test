<!-- Context: remix3/html-template | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# html-template Context

**Purpose**: Safe HTML template literals with automatic XSS escaping and trusted raw HTML insertion.

## Source Map

- **Package root**: `/home/lucky/remix/packages/html-template/`
- **Implementation**: `src/lib/safe-html.ts` (113 lines)
- **Tests**: `src/lib/safe-html.test.ts` (129 lines)
- **Entry**: `src/index.ts` — re-exports `html`, `isSafeHtml`, `SafeHtml`
- **Install**: `npm i remix` → import from `remix/html-template`

## Files

| File | Type | Lines | Content |
|------|------|-------|---------|
| `concepts/safe-html.md` | Concept | ~40 | SafeHtml branded type, `isSafeHtml` guard, branding mechanics |
| `concepts/escaping-model.md` | Concept | ~45 | Two-tier escaping: `html` vs `html.raw`, composition rules |
| `examples/template-usage.md` | Example | ~65 | Escaping, raw HTML, composition, arrays, conditionals |
| `lookup/api.md` | Lookup | ~40 | Quick reference: all exports, types, escape map |

## Related

- `/development/remix3/packages/concepts/html-template.md` — High-level package overview
