<!-- Context: project-intelligence/my_app/errors/vdom-testing-gotchas | Priority: medium | Version: 1.0 | Updated: 2026-05-05 -->

# Error Reference: VDOM Testing Gotchas

**Purpose**: Document quirks discovered while writing VDOM component tests against Remix 3's `$rmx`-tagged virtual DOM trees. These patterns apply to all `remix/test` component tests.

---

## 1. Button Node `type` is a Function Reference, Not a String

**Symptom**: `findElement(tree, (el) => el.type === 'button')` does NOT find `<Button>` nodes.

**Root cause**: When `Button` from `remix/ui/button` is rendered in a VDOM test tree, the node's `type` property is the `Button` function reference, not the string `'button'`.

```typescript
// ❌ WRONG: This won't find Button nodes
const btn = findElement(tree, (el) => el.type === 'button')

// ✅ CORRECT: Search by props/attributes instead
const btn = findElement(tree, (el) =>
  (el.props as Record<string, unknown>)['data-pagination'] === 'true'
)
```

**Rule**: Always search for Remix 3 UI components by their `props` (attributes, data-* attributes, children text) — never by `type` string matching. `type` string matching only works for native HTML elements (`'td'`, `'th'`, `'div'`, etc.), not for Remix UI primitives.

---

## 2. `$rmx` Marker Required for VDOM Walking

All VDOM test helpers (`findElement`, `findElementByProp`, `treeContainsText`) depend on `$rmx: true` being present on element nodes. If the rendering pipeline doesn't produce `$rmx`-tagged trees, these helpers return nothing.

The `RemixElement` interface in test files must include `$rmx: true`:

```typescript
interface RemixElement {
  type: string | Function  // Function for Remix components, string for HTML
  props: Record<string, unknown>
  key?: unknown
  $rmx: true               // ← required for tree walking
}
```

---

## 3. Theme Contract Properties: `foreground`, Not `text`

When asserting against computed CSS or styles using `theme.*` tokens, remember that action colors use `foreground` (not `text`) and `backgroundHover` (not `hover`):

```typescript
// If a mixin uses:
css({ color: theme.colors.action.primary.foreground })

// The test must use the same token name — foreground, not text
// These properties compile to CSS custom properties at runtime:
// var(--rmx-color-action-primary-foreground)
```

**This matters** when writing tests that inspect `el.props.mix` or style objects directly — the property name in the `css()` object IS `foreground`, not `text`.

---

## 4. VDOM Helpers are Duplicated Per Test File

There is no shared `test-utils.ts` for VDOM tree walking. Each component test file defines its own `findElement`, `findElementByProp`, `treeContainsText`, and `RemixElement` interface inline. This is intentional — tests are self-contained and don't depend on shared utilities.

**Test files with inline VDOM helpers** (as of May 2026):
- `grid-page.test.ts`
- `page.test.ts`
- Various component tests under `app/actions/*/`

---

## 📂 Codebase References

- VDOM test helpers: `my_app/app/actions/client/grid-page.test.ts` (lines 10-57)
- Button nodes in VDOM: `my_app/app/actions/client/grid-page.test.ts` (lines 119-165 — find by `data-pagination` + `data-offset`)
- Native element type matching: `my_app/app/actions/client/grid-page.test.ts` (line 180 — `typeof el.type === 'string'`)

## Related

- `../concepts/testing-conventions.md` — Test framework selection and conventions
- `../lookup/test-patterns.md` — Quick reference for VDOM helpers and auth cookies
- `../concepts/mixin-architecture.md` — Theme contract naming conventions
- `../guides/css-mixin-usage.md` — Theme token property reference
