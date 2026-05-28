<!-- Context: development/remix3/guides/manual-fetch-patterns | Priority: high | Version: 1.1 | Updated: 2026-05-13 -->

# Manual Fetch + Event Delegation for DOM-Swapping UIs

**Purpose**: When `<Frame>` reloads aren't the right choice, use `fetch()` + `DOMParser` + `innerHTML` for smooth UX transitions. Pair with `document.addEventListener` + `closest()` delegation that survives DOM swaps.

## When to Use Manual Fetch Over Frame

| Approach | Use Case | Trade-off |
|----------|----------|-----------|
| `<Frame>` with `reload()` | Full route lifecycle | Built-in lifecycle, less control over transitions |
| Manual `fetch` + `innerHTML` | Opacity fades, partial region updates | Must manage lifecycle manually |

Best for: smooth opacity transitions, partial page updates, fine-grained error handling.

## Core Pattern: fetch + DOMParser + innerHTML

```typescript
function fetchPage(offset: number, sort?: string, order?: string): void {
  let container = document.getElementById('content-region')
  if (!container) return
  container.style.opacity = '0.5'
  container.style.transition = 'opacity 120ms'
  fetch('/data?' + new URLSearchParams({
    offset: String(offset),
    ...(sort ? { sort, order: order || 'asc' } : {}),
  }), { credentials: 'same-origin' })
    .then((r) => r.text())
    .then((html) => {
      let doc = new DOMParser().parseFromString(html, 'text/html')
      let newContent = doc.getElementById('content-region')
      if (newContent) { container.innerHTML = newContent.innerHTML; container.style.opacity = '1' }
    })
    .catch(() => { container.style.opacity = '1' })
}
```

**Flow**: Server renders fragment with wrapper → client fades to 50% → `fetch` gets HTML → `DOMParser` extracts new content → `innerHTML` swap → fade back. All old DOM elements are destroyed.

## Event Delegation (Survives DOM Swaps)

`innerHTML` destroys all child event listeners. Use `document.addEventListener` with `.closest()` filtering:

```typescript
handle.queueTask(() => {
  document.addEventListener('click', (e) => {
    let btn = (e.target as HTMLElement).closest('[data-pagination]')
    if (!btn) return
    fetchPage(Number(btn.getAttribute('data-offset')), btn.getAttribute('data-sort') || undefined)
  }, { signal: handle.signal })

  document.addEventListener('click', (e) => {
    let th = (e.target as HTMLElement).closest('[data-sortable]')
    if (!th) return
    // toggle sort logic, then fetchPage(0, newSort, newOrder)
  }, { signal: handle.signal })
})
```

**Key point**: Listeners registered once on `document`, filter by `data-*` attributes. New DOM elements from `innerHTML` swaps match the same attributes.

## Data Attributes Convention

```html
<button data-pagination data-offset="20" data-sort="name" data-order="asc">Next</button>
<th data-sortable data-field="name">Name <span>↕</span></th>
<td data-editable data-row-id="42" data-field="name" tabindex="0">Alice</td>
<button data-edit data-row-id="42" data-offset="0">Edit</button>
<button data-delete data-row-id="42" data-confirm="Delete row #42?">Del</button>
```

Handlers check one attribute via `closest()` and read others for state.

## Form Submissions After DOM Swaps

```typescript
document.addEventListener('submit', (e) => {
  let form = (e.target as HTMLElement).closest('#edit-form') as HTMLFormElement | null
  if (!form) return
  e.preventDefault()
  // fetch() the submission, then re-fetch grid on success
}, { signal: handle.signal })
```

## Codebase References

- `my_app/app/assets/grid-client.ts` — Full implementation: fetchPage, event delegation, inline editing
- `my_app/app/actions/client/grid-page.tsx` — Server-rendered grid with data-* attributes
- `my_app/app/actions/client/controller.tsx` — Server endpoints for `/client/grid` and `/client/edit-fragment/:rowId`

## Related

- `ui/guides/client-entry-side-effects.md` — clientEntry with queueTask + signal
- `guides/frame-navigation-patterns.md` — Frame approach comparison
- `guides/inline-editing-patterns.md` — Inline cell editing (same event delegation)
- `ui/guides/client-interactivity-patterns.md` — Client interactivity approaches
