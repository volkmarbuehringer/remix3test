---
name: remix3-html-amp-escaped-assertions
description: "Use when a `remix test` string assertion on rendered HTML fails for a URL/query-string attribute (href, action) — the framework HTML-escapes `&` to `&amp;`, so match `&amp;` in `response.text()`, not the raw `&`."
metadata:
  origin: auto-extracted
---

# Remix 3 Rendered-HTML `&amp;` Escaping in Test Assertions

**Extracted:** 2026-09-15
**Context:** Asserting on rendered HTML in `remix test` server-render tests (e.g. checking a filter-tab link's `href` carries the right query params).

## Problem

A `remix test` assertion like `assert.ok(text.includes('?filter=enabled&sort=name&order=asc'))` fails even though the component clearly renders that URL. The rendered HTML escapes the `&` separators in attribute values to `&amp;`:

```html
<a href="/admin/users?filter=enabled&amp;sort=name&amp;order=asc">Aktiv</a>
```

`response.text()` returns the raw serialized HTML (entities intact), so a string assertion written with the unescaped `&` never matches. The failure is silent about the cause — the string looks right in the source.

## Solution

When asserting on a URL/query string inside a rendered attribute, match the escaped form:

```ts
let text = await response.text()
assert.ok(
  text.includes('?filter=enabled&amp;sort=name&amp;order=asc'),
  'Aktiv tab should reset the offset',
)
```

General rules:
- In rendered HTML, `&` in attribute values serializes as `&amp;` (also `"` → `&quot;` where relevant). Match the escaped form in `response.text()` assertions.
- To assert a substring is *absent*, also use the escaped form (e.g. `!text.includes('filter=enabled&amp;sort=name&amp;order=asc&amp;offset')`).
- Prefer asserting on a redirect `Location` header instead of rendered HTML when possible — headers are not HTML-escaped (`response.headers.get('Location')` keeps raw `&`).

## When to Use

- A `remix test`/server-render assertion on an `href`, `action`, or any attribute containing query parameters fails unexpectedly
- Verifying filter-tab/sort/pagination links in a grid page by string-matching `response.text()`
- Writing a new assertion that checks a URL inside rendered markup