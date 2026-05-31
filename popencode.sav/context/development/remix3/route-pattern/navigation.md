<!-- Context: development/remix3/route-pattern | Priority: high | Version: 1.0 | Updated: 2026-05-20 -->

# Route Pattern — Type-Safe URL Matching & Href Generation

**Core Idea**: Type-safe URL matching and href generation using path variables, wildcards, optionals, and search constraints — built on deterministic trie-based ranking. Exported from `remix/route-pattern`.

## Quick Routes

| Task | File |
|------|------|
| Pattern syntax (variables, wildcards, optionals) | `concepts/pattern-syntax.md` |
| Parse & stringify patterns | `concepts/parse-stringify.md` |
| Specificity ranking rules | `concepts/specificity-ranking.md` |
| Match a single pattern | `guides/single-matcher.md` |
| Match many patterns (trie-based) | `guides/multi-matcher.md` |
| Generate hrefs from patterns | `guides/href-generation.md` |
| Join patterns together | `guides/pattern-joining.md` |
| CreateHrefError handling | `errors/create-href-errors.md` |

## Source

- Package source: `~/remix/packages/route-pattern/`
- Exports: `remix/route-pattern`, `remix/route-pattern/match`, `remix/route-pattern/href`, `remix/route-pattern/join`, `remix/route-pattern/specificity`

## Related

- [Remix Routing](../../routing/navigation.md) — Route definitions and controllers
- [Remix Middleware](../../middleware/navigation.md) — Middleware chain for request handling
