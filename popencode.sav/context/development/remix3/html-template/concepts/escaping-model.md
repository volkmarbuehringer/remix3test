<!-- Context: remix3/html-template/concepts | Priority: medium | Version: 1.0 | Updated: 2026-05-20 -->

# Escaping Model

**Core Idea**: Two-tier system — `html\`...\`` auto-escapes interpolations, while `html.raw\`...\`` passes them through verbatim. Both prevent double-escaping of already-safe `SafeHtml` values.

## Tier 1: `html` — Automatic Escaping

All non-SafeHtml interpolations are escaped for 5 HTML-sensitive characters:

| Char | Entity |
|------|--------|
| `&` | `&amp;` |
| `<` | `&lt;` |
| `>` | `&gt;` |
| `"` | `&quot;` |
| `'` | `&#39;` |

`&` is escaped first (the map handles correct substitution). Null/undefined render as empty string.

## Tier 2: `html.raw` — Passthrough

- **Strings**: passed as-is — no escaping (trust the caller)
- **SafeHtml**: unwrapped and included verbatim
- **Numbers/booleans**: stringified without escaping
- **Null/undefined**: empty string

> **⚠️ Security**: `html.raw` trusts all string interpolations as safe. Never pass unsanitized user input. For conditional XSS-safe insertion, pre-escape via `html` and nest the result.

## Composition Rules

| Input | in `html` | in `html.raw` |
|-------|-----------|---------------|
| `SafeHtml` | Unwrapped, no re-escape | Unwrapped, no re-escape |
| `string` | `escapeHtml(value)` | `value` (as-is) |
| `number` | `escapeHtml(String(v))` | `String(v)` |
| `boolean` | `escapeHtml(String(v))` | `String(v)` |
| `null/undefined` | `''` | `''` |
| `Array<Interpolation>` | Recursively processed & joined | Recursively processed & joined |

## Related

- `concepts/safe-html.md` — Branded type mechanics
- `examples/template-usage.md` — Composition in practice
- `lookup/api.md` — All APIs at a glance
