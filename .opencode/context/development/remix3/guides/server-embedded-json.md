<!-- Context: development/remix3/guides/server-embedded-json | Priority: medium | Version: 1.0 | Updated: 2026-05-07 -->

# Server-Embedded JSON Configuration

**Purpose**: Pass server-originating data (dropdown options, configuration, enum values) to client code by embedding it as a `<script type="application/json">` tag in the server-rendered HTML.

---

## 1. The Problem

Client entry code sometimes needs data that originates on the server — dropdown options, enum values, configuration maps. Hardcoding this in the client asset file creates a sync problem: the server knows the valid options, but the client must be updated separately.

## 2. The Pattern: JSON Script Tag

**Server** embeds the data directly in the SSR HTML:

```tsx
// Server-rendered page
import type { Handle } from 'remix/ui'

function ClientPage(handle: Handle<{ fieldOptions: Record<string, string[]> }>) {
  return () => {
    let { fieldOptions = { role: ['Admin', 'Editor', 'Viewer'], status: ['Active', 'Inactive'] } } = handle.props
    return (
      <div>
        <script
          type="application/json"
          id="field-options"
        >{JSON.stringify(fieldOptions)}</script>
        {/* ... rest of the page ... */}
      </div>
    )
  }
}
```

**Client** reads it during initialization:

```typescript
let options = JSON.parse(
  document.getElementById('field-options')?.textContent || '{}'
)
// options = { role: ['Admin', 'Editor', 'Viewer'], status: ['Active', 'Inactive'] }
```

## 3. Why This Works with Fragment Fetches

When using manual `fetch()` + `DOMParser` + fragment swapping, the content region must include the script tag:

```html
<div id="client-grid-content">
  <script type="application/json" id="field-options">
    {"role":["Admin","Editor","Viewer"],"status":["Active","Inactive"]}
  </script>
  <table>...</table>
</div>
```

The `<script type="application/json">` tag is **not** executed by the browser (no `src`, no JavaScript). It's just data storage. When `DOMParser` parses the fragment HTML and the new `#client-grid-content` is swapped in, the new `<script>` tag data becomes available.

**Important**: The script tag must be inside the swapped region. If it's outside, it won't be updated after DOM swaps.

## 4. When to Use vs. Hardcoding

| Approach | When to Use |
|----------|-------------|
| **Hardcoded client options** | Options are static, rarely change, small sets |
| **Server-embedded JSON** | Options originate from database, change dynamically, or differ per-user |
| **API endpoint** | Options are large, change frequently, or need lazy-loading |

Server-embedded JSON is ideal when:
- Options are known at render time and fit in the HTML payload
- You want a single source of truth (server defines what's valid)
- The data travels with the fragment during pagination/fetches

## 5. Alternative: URL Params for Simple Values

For small configuration values, URL search parameters can also pass data:

```typescript
// Server includes data in URL
fetch('/grid?options=' + encodeURIComponent(JSON.stringify(options)))

// Client reads from URL
let params = new URLSearchParams(window.location.search)
let options = JSON.parse(params.get('options') || '{}')
```

But script tags are preferred when:
- The data is shared across multiple client interactions (not just one fetch)
- The data is referenced by repeated fragment fetches
- URL length limits could be a concern

## 6. Concrete Example from my_app

Server (controller):
```typescript
const FIELD_OPTIONS: Record<string, string[]> = {
  role: ['Admin', 'Editor', 'Viewer'],
  status: ['Active', 'Inactive'],
}

// Passed as props to the page template
render(<ClientPage fieldOptions={FIELD_OPTIONS} ... />)
```

Page template includes the script tag alongside the grid:
```tsx
<div id="client-grid-content">
  <script type="application/json" id="field-options">
    {JSON.stringify(fieldOptions)}
  </script>
  <table>...</table>
</div>
```

Client uses it to build dropdown editors for inline cell editing:
```typescript
// Client: dropdown options read from embedded JSON
const DROPDOWN_OPTIONS: Record<string, string[]> = {
  role: ['Admin', 'Editor', 'Viewer'],
  status: ['Active', 'Inactive'],
}

function createEditor(field: string, currentValue: string) {
  let options = DROPDOWN_OPTIONS[field]
  if (options) {
    let select = document.createElement('select')
    for (let opt of options) {
      let optionEl = document.createElement('option')
      optionEl.value = opt
      optionEl.textContent = opt
      if (opt === currentValue) optionEl.selected = true
      select.appendChild(optionEl)
    }
    return { element: select, getValue: () => select.value }
  }
  // fallback to text input...
}
```

## Codebase References

- `my_app/app/actions/client/controller.tsx` — FIELD_OPTIONS defined server-side, passed as prop
- `my_app/app/actions/client/grid-page.tsx` — Server-rendered grid with embedded data (field options, row data)
- `my_app/app/actions/client/page.tsx` — Page layout passes fieldOptions as prop to grid
- `my_app/app/assets/grid-client.ts` — Client reads DROPDOWN_OPTIONS (currently hardcoded, could read from embedded script tag)

## Related

- `guides/manual-fetch-patterns.md` — Script tags travel with fetched fragments
- `guides/inline-editing-patterns.md` — Dropdown editors use these options
