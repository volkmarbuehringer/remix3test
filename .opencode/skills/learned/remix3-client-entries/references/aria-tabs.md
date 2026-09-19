# Remix 3 ARIA Tabs with Hash Deep-Linking

**Source:** `remix3-aria-tabs`

**Extracted:** 2026-09-17
**Context:** Converting a single app page (four stacked panels + an anchor "jump"
nav) into real tabs in a React-free Remix 3 app: one panel visible at a time, the
URL hash selects the tab, and keyboard users can move between tabs. Verified
against the server-rendered HTML and a Chromium session.

## Problem

A Remix 3 page renders all sections in one document. Turning them into tabs in a
`clientEntry` hits five non-obvious traps:

1. **`hidden` doesn't hide.** The shared panel descriptor sets `display:flex`,
   which (author origin) beats the UA `[hidden]{display:none}` rule, so
   `panel.hidden = true` does nothing. See `remix3-css-and-layout` → `references/hidden-attribute-display-override.md`.
2. **The server can't see the URL hash.** Fragments are never sent to the server,
   so SSR cannot know which tab is active; the client entry must reconcile the
   hash with the server's default.
3. **Focus runs before visibility.** Existing "focus the error banner" logic
   calls `alert.focus()`; if it runs before inactive panels are hidden, it can
   focus a `display:none` node. Apply tab visibility first.
4. **`preventDefault()` kills the free fallback.** Buttons with a swallowing
   click handler leave no no-JS path and no history. Anchors with
   `href="#panel-id"` give native hash/history/scroll behavior instead.
5. **The whole page flashes on first paint.** If every panel is rendered
   un-hidden server-side, the browser paints the full stacked page until the
   client entry's `queueTask` runs and hides the inactive panels. Hiding them
   only in JS is the bug, not the fix. The two obvious no-JS reveal fixes are
   themselves traps: `<noscript>` is re-parsed into a live `<style>` after the
   first patch, and a JS-set `<html data-js>` flag is wiped when the runtime
   reconciles the document element.

## Solution

### Server: a tablist of anchors + `hidden`-capable panels

```tsx
const TABS = [
  { id: 'settings-profile', label: 'Profil' },
  { id: 'settings-display', label: 'Anzeige' },
  // ...
] as const
type TabId = (typeof TABS)[number]['id']

<div mix={tabListCss} role="tablist" aria-label="…">
  {TABS.map((tab) => (
    <a mix={tabCss} href={`#${tab.id}`} id={`${tab.id}-tab`} role="tab"
       aria-controls={tab.id} aria-selected={tab.id === activeTab ? 'true' : 'false'}
       tabindex={tab.id === activeTab ? 0 : -1} data-settings-tab>
      {tab.label}
    </a>
  ))}
</div>

<div id="settings-profile" role="tabpanel" aria-labelledby="settings-profile-tab"
     tabindex={0} data-settings-tabpanel>…</div>
```

Mark the active tab from a prop (`activeTab`, default first). Add
`'&[hidden]': { display: 'none' }` to the panel `css()` descriptor (same
descriptor, same layer) before `panel.hidden = true` can work.

**Render the inactive panels `hidden` on the server** so only the active panel
paints on first load — otherwise the full stacked page flashes before the client
entry runs:

```tsx
let panelHidden = (tabId: TabId) => (tabId === activeTab ? undefined : true)
// …
<div id="settings-profile" role="tabpanel" … data-settings-tabpanel
     hidden={panelHidden('settings-profile')}>…</div>
```

Keep the no-JS path with a rule scoped to the `scripting` media feature. The
browser evaluates it against the real scripting setting and it survives client
DOM patching:

```tsx
<style>{'@media (scripting: none) { [data-settings-tabpanel][hidden] { display: flex !important; } }'}</style>
```

Two fixes to avoid:
- **Do not use `<noscript>`.** After the first client-side patch the Remix UI
  runtime re-parses the noscript body into a live `<style>` element, so the
  reveal rule goes live with JS enabled and every panel shows at once (observed:
  the noscript's `childElementCount` goes 0 → 1 after a single tab click).
- **Do not gate the reveal on a JS-set flag** such as `<html data-js>` written by
  an inline head script: the runtime reconciles the document element against the
  server HTML and drops the attribute, so the override stops matching after the
  first navigation.

The client `init()` still reconciles a matching `#hash` (deep links) and the
server-selected `[aria-selected="true"]` tab; it only needs to toggle panels
between themselves, never to perform the first hide.

### Server: keep the right tab after a POST

A full-page POST drops the fragment, so an error re-render must be told which tab
was active, and a PRG redirect must carry the fragment:

```tsx
// error re-render
return context.render(<SettingsPage … activeTab="settings-password" />, { status: 400 })
// success redirect — fragment keeps the working tab; the inner scroll container
// scrolls, so a flash banner rendered outside it stays visible
return redirect(`${routes.settings.index.href()}#settings-display`)
```

Add `data-settings-active-tab={activeTab}` to the panel container so server tests
(which never run JS) can assert which tab is active on an error render.

### Client entry: switch, sync the hash, keyboard

```ts
function activate(panelId: string, opts: { focus?: boolean; setHash?: boolean } = {}) {
  const tabs = [...document.querySelectorAll<HTMLAnchorElement>('[data-settings-tab]')]
  const target = tabs.find((t) => t.getAttribute('aria-controls') === panelId)
  if (!target) return
  for (const tab of tabs) {
    const selected = tab === target
    tab.setAttribute('aria-selected', selected ? 'true' : 'false')
    tab.tabIndex = selected ? 0 : -1
  }
  for (const panel of document.querySelectorAll<HTMLElement>('[data-settings-tabpanel]')) {
    panel.hidden = panel.id !== panelId
  }
  if (opts.focus) target.focus()
  if (opts.setHash) history.replaceState(null, '', `#${panelId}`)
}

function init() {                     // hash wins; else the server-selected tab
  const panels = [...document.querySelectorAll<HTMLElement>('[data-settings-tabpanel]')]
  const hash = location.hash.slice(1)
  if (panels.some((p) => p.id === hash)) return activate(hash)
  const selected = document.querySelector('[data-settings-tab][aria-selected="true"]')
  const id = selected?.getAttribute('aria-controls') ?? panels[0]?.id
  if (id) activate(id)
}
```

- `click` on a tab → `activate(panelId)` and **do not** `preventDefault()`; the
  anchor updates the hash/history and the browser scrolls the visible panel in.
- `hashchange` → `activate(hash)` for back/forward and deep links.
- `keydown` ArrowLeft/ArrowRight/Home/End → `activate(nextId, { focus: true, setHash: true })`
  with `event.preventDefault()`.
- `queueTask` order: `init()` first, then any focus-banner logic, so focus never
  lands on a hidden panel.

Roving-tabindex/keyboard details for lists with nested controls are covered by
`roving-tabindex-keyboard-lists`; the active-tab visual uses
`&[aria-selected="true"]` declared after `&:hover` in the same descriptor.

### Tests

Server tests only see HTML: assert one `role="tab"`/`role="tabpanel"` per section
plus `href="#<id>"`/`aria-controls`, `data-settings-active-tab` after an error
POST, and `Location.endsWith('#<id>')` after a PRG redirect. Also assert the
no-flash contract directly: the active panel's opening tag carries no `hidden`
attribute, every inactive panel's tag does, and the `@media (scripting: none)`
reveal rule is present. Switching, keyboard, and deep-link behavior need a browser check.

## When to Use

- A Remix 3 page has two or more same-page sections that should show one at a time.
- An anchor "jump" nav should become real tabs that deep-link via the URL hash.
- You need keyboard (Arrow/Home/End) tab navigation with a no-JS stacked fallback.
