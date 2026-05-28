<!-- Context: project-intelligence/my_app/guides | Priority: high | Version: 2.0 | Updated: 2026-05-05 -->

# Guide: Client Route 50/50 Layout + Frame Edit Panel

**Purpose**: Document the 50/50 split layout for the `/client` route, the Frame-based edit panel pattern, and the hybrid approach for programmatic Frame navigation.

## Architecture

The client route uses a horizontal 50/50 split: left pane for the data grid, right pane for an independently-rendered edit form.

```
┌────────────────────┐
│ Layout              │
│ ┌────────┐┌───────┐│
│ │ Grid   ││ Frame ││
│ │ (SSR)  ││ <Frame││
│ │        ││  name=││
│ │        ││ "clien││
│ │        ││ t-edit││
│ │        ││ ">    ││
│ └────────┘└───────┘│
│ GridClient           │
│ (click → navEditPanel│
│  → fetch + DOM)      │
└────────────────────┘
```

## Frame for Edit Panel

The edit panel uses a Remix 3 `<Frame>` for server-side rendering of the edit form:

```tsx
// my_app/app/actions/client/page.tsx
import { Frame } from 'remix/ui'
import { frames, routes } from '../../routes.ts'

<Frame
  name={frames.clientEdit}
  src={`${routes.client.editFragment.href({ rowId: String(initialRow?.id ?? 1) })}?offset=${initialOffset}&sort=${initialSort}&order=${initialOrder}`}
/>
```

The Frame loads its content from `/client/edit-fragment/:rowId` via the server-side `resolveFrame` pipeline in `render.tsx`. This ensures:
- Initial edit form is SSR'd as part of the page
- The Frame's content is rendered between `<!-- rmx:f:id -->` markers in the HTML
- The Frame runtime hydrates and manages the content area

## Why Hybrid (Frame SSR + fetch/DOM for Navigation)

Pure Frame navigation (via `navigate(href, { target })`) was attempted but had reliability issues:

| Approach | Result |
|----------|--------|
| `navigate(src, { target, history: 'replace' })` | Only fired once; subsequent calls ignored |
| `<a rmx-target>` programmatic `.click()` | Chrome doesn't set `event.sourceElement` for programmatic clicks |
| `window.navigation.navigate()` directly | URL changed but Frame `reload()` didn't fire — `event.destination.getState()` didn't return `$rmx` state |

**Final solution**: Frame handles initial SSR only. Row-to-row navigation uses `fetch(url)` + DOM replacement within the Frame's content area:

```typescript
// my_app/app/assets/grid-client.ts
function navEditPanel(rowId, offset, sort, order): void {
  let url = buildEditFragmentSrc(rowId, offset, sort, order)
  fetch(url, { credentials: 'same-origin' })
    .then(r => r.text())
    .then(html => {
      let doc = new DOMParser().parseFromString(html, 'text/html')
      let newForm = doc.getElementById('edit-form')
      let currentForm = document.getElementById('edit-form')
      if (newForm && currentForm && currentForm.parentElement) {
        currentForm.parentElement.innerHTML = newForm.outerHTML
      }
    })
}
```

This pattern replaces the form content inside the Frame's rendering root without triggering the Navigation API. Events bubble normally since Frames render inline in the same document.

## Server-Side Rendering

- Page controller (`index` action): renders the main page with `<Frame>` for edit panel + `<ClientGridPage>` for grid
- `grid` action: renders just the grid table fragment (used by pagination/sort AJAX)
- `editFragment` action: renders just the edit form (used by Frame initial SSR and `navEditPanel` fetch)
- Grid content sorted/paginated server-side via `sortRows()` + slice

## Codebase References
- Page layout: `my_app/app/actions/client/page.tsx`
- Controller: `my_app/app/actions/client/controller.tsx`
- Grid component: `my_app/app/actions/client/grid-page.tsx`
- Edit form: `my_app/app/actions/client/edit-form.tsx`
- Grid client (interactivity): `my_app/app/assets/grid-client.ts`
- Render utility: `my_app/app/actions/render.tsx` (resolveFrame, x-remix-frame header)
- Client entry: `my_app/app/assets/entry.ts` (client-side resolveFrame)
- Routes: `my_app/app/routes.ts` (frames constant)

## Related
- [Inline Editing Patterns](./inline-editing-patterns.md)
- [Client Pagination + Sort](./client-pagination-sort.md)
- [Frame Rendering Gotchas](../errors/frame-rendering-gotchas.md)
