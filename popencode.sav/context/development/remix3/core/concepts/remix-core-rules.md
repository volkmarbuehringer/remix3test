<!-- Context: development/remix3/core/concepts/remix-core-rules | Priority: critical | Version: 1.0 | Updated: 2026-04-30 -->

# Concept: Remix Core Rules

**Core Idea**: 13 fundamental rules for building Remix 3 apps. Import from subpaths, treat routes.ts as URL truth, return explicit Responses, validate at boundaries.

## Key Points

1. **Subpath imports only** — `import from 'remix/<subpath>'`, never `import { ... } from 'remix'`
2. **routes.ts is URL truth** — Use `routes.<name>.href(...)` for redirects, links, tests
3. **Explicit Responses** — Return `Response` objects (redirects, 404s, validation failures). Prefer returning over throwing for expected outcomes
4. **Model HTTP explicitly** — Status codes, headers, redirects, cache rules, content types are part of the route contract
5. **Server route first** — POST should return correct HTML/redirect/error before `clientEntry(...)` adds interactivity
6. **Validate at boundary** — Use `remix/data-schema` + `parseSafe` for `Request`, `FormData`, params, cookies, external payloads
7. **Typed AppContext** — Derive from root middleware stack: `get(Database)`, `get(Session)`, `get(Auth)`
8. **getContext needs asyncContext** — Only use `getContext()` when `asyncContext()` is in the middleware stack
9. **Component ≠ React** — Read props from `handle.props`, state in setup-scope vars, call `handle.update()` explicitly, DOM work in event handlers or `queueTask(…)`. Components are plain factory functions (no `component()` wrapper). `handle` is only available in `clientEntry` components; server-rendered components cannot use `handle.context`
10. **Prefer `mix` over custom props** — Use `mix={mixin(...)}` for behavior/styling, `mix={[...]}` only when composing multiple
11. **Serializable clientEntry props** — No functions, class instances, or opaque runtime objects
12. **Narrowest owner** — Route-local code first, promote only when reuse is real
13. **narrowest test layer** — Router tests for route behavior, component tests for DOM-specific behavior

## Reference

- Full skill: `~/remix/skills/remix/SKILL.md`
- Component model: `../../ui/concepts/component-model.md`
- Validation: `../../data/guides/input-validation.md`
- Context API limitation: `../../ui/errors/context-api-ssr-limitation.md`

> **Note**: The `remix/component` subpath is NOT defined in remix's package.json exports. The `component()` function referenced in some older docs does NOT exist. Use `clientEntry()` for browser-interactive components; all components are plain factory functions.
