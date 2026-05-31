---
title: clientEntry + Frame Hydration
category: project-intelligence
type: error
source: app/assets/grid-client.ts, app/actions/client/edit-form.tsx
---

# clientEntry + Frame Hydration

## Core Concept

Components using `on('click')` mixins (like `Select` from `remix/ui/select`) **require `clientEntry`** to attach event handlers on the client. SSR renders the structure; the runtime attaches the behavior. Without `clientEntry`, these components render visually but don't respond to interaction.

## The Structural Problem

The client grid's `navEditPanel` function (`app/assets/grid-client.ts`) used this pattern:

```typescript
fetch(url).then(html => {
  currentForm.parentElement.innerHTML = newForm.outerHTML  // raw DOM swap
})
```

This bypasses the Remix runtime entirely — no diff, no hydration, no event handlers. The `Select` components rendered but clicks did nothing.

### Three Failed Fix Approaches

**1. `clientEntry` alone** — Works for the initial Frame load (page render), but `navEditPanel`'s raw DOM swap on every subsequent row click strips the hydration markers. Each click creates fresh HTML that the runtime never processes.

**2. `navigate(url, { target })`** — Uses the Navigation API to route through the runtime. The Frame reloads correctly with hydration. But after form saves, multiple `navigate()` calls with `history: 'replace'` conflict with `fetchPage`'s `history.replaceState()`, causing navigation failures on subsequent row clicks.

**3. `frame.src = url; frame.reload()` via FrameHandle** — Direct frame handle access via `handle.frames.get('client-edit')`. Technically correct but the Frame returned stale content on repeated calls — the wrong row's data appeared. Root cause unclear (possibly timing with `reloadController.abort()`).

### Why the Tension Exists

The original `navEditPanel` intentionally bypassed the Frame diff algorithm with a comment:
```
"Manual fetch + DOM swap (bypasses Frame diff algorithm which preserves
form field values to avoid clearing user input during live updates)"
```

But `clientEntry` hydration needs the Frame's reload pipeline to process `rmx:h:` markers. These are fundamentally incompatible: you can't both bypass the Frame AND have hydration work.

### What a Proper Fix Would Look Like

Replace the custom JS event delegation with Remix's built-in frame navigation pattern:

```tsx
// Instead of <Button data-edit={true} ... onClick={navEditPanel}>
// Use anchor tags with rmx-target (as admin pages do):
<a href={editFragmentUrl} rmx-target={frames.clientEdit}>Edit</a>
```

This lets the runtime handle content loading end-to-end, preserving hydration. It requires:
- Changing `grid-page.tsx` Edit buttons from `<Button>` with custom handlers to `<a>` with `rmx-target`
- Removing `navEditPanel` / `fetchPage`'s raw DOM manipulation
- Adding the `rmx-target` navigation attribute handling

## Key Points

- `Select`, `Menu`, `Popover`, `Combobox`, `Listbox` — all popover-backed components — need `clientEntry`
- `Button` with `tone` variants does NOT need `clientEntry` (it uses CSS only)
- Frame content loaded via the runtime's `reload()` pipeline preserves hydration
- Raw innerHTML swaps strip hydration markers — event handlers are lost
- `navigate()` via Navigation API is unreliable for rapid sequential frame loads
- `handle.frames.get(name)` gives access to FrameHandle; `.src` + `.reload()` navigates it

## Reference

- `app/assets/grid-client.ts` — `navEditPanel` function (3 failed approaches)
- `app/actions/client/edit-form.tsx` — `clientEntry` wrapper
- `remix/ui/select` — Select component source
- Admin pages (`app/actions/admin/`) — working `rmx-target` frame navigation
- [Pre-built Component SSR Bridge (newapp)](../../newapp/errors/prebuilt-component-ssr-bridge.md) — Related: pre-built components need `clientEntry` because their modules aren't shipped to the client from server-only imports
