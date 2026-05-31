<!-- Context: project-intelligence/newapp/guides/sticky-footer-layout | Priority: high | Version: 1.0 | Updated: 2026-05-11 -->

# Guide: Sticky Footer + Scrollable Content Layout

**Core Idea**: Use `display: flex; flex-direction: column; min-height: 100vh` on `<body>` so the footer stays at the bottom regardless of content height, and the content area scrolls independently.

---

## Architecture

The layout is split across two files:

| File | Role |
|------|------|
| `app/ui/document.tsx` | Wraps `<body>` with flex container + theme tokens |
| `app/ui/layout.tsx` | Provides the shell (header, nav, content, footer) |

---

## Body Styles (`document.tsx`)

```tsx
<body
  mix={css({
    margin: 0,
    fontFamily: themeTokens.fontFamily.sans,
    backgroundColor: themeTokens.surface.lvl0,
    color: themeTokens.colors.text.primary,
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  })}
>
```

The `<body>` element:
- **Flex column** — children (the layout shell) stack vertically
- **Full viewport height** — `min-height: 100vh` ensures footer reaches bottom even on short pages
- **Theme-driven typography** — `fontFamily`, `color`, `backgroundColor` set once, inherited by all pages
- **No margin** — `margin: 0` removes default browser body margin

> Every page automatically gets these styles. No per-page `<body>` setup is needed.

---

## Layout Shell (`layout.tsx`)

```tsx
<div mix={shellCss}>           {/* flex: 1, min-height: 0 */}
  <header mix={headerStyle}>   {/* sticky top, z-index: 100 */}
    {/* nav, logo, theme toggle */}
  </header>
  <main mix={mainStyle}>       {/* flex: 1, overflow: hidden */}
    <div mix={pageStyle}>      {/* overflow-y: auto, flex: 1 */}
      {children}
    </div>
  </main>
  <footer mix={footerStyle}>   {/* flex-shrink: 0 */}
    {/* copyright */}
  </footer>
</div>
```

### CSS Breakdown

| Element | Key Properties | Purpose |
|---------|---------------|---------|
| `shellCss` | `display: flex; flex-direction: column; flex: 1; min-height: 0` | Fills body height, column-stacks children |
| `headerStyle` | `position: sticky; top: 0; z-index: 100` | Stays at top when scrolling |
| `mainStyle` | `flex: 1; overflow: hidden` | Fills remaining vertical space, contains scroll |
| `pageStyle` | `flex: 1; overflow-y: auto` | Scrollable content area — this is where the page scrolls |
| `footerStyle` | `flex-shrink: 0` | Never shrinks, stays at bottom |

### How the Scroll Works

1. `min-height: 100vh` on `<body>` ensures the layout fills the viewport
2. `flex: 1` on the shell div makes it fill body height
3. `flex: 1; overflow: hidden` on `<main>` gives remaining space to content
4. `overflow-y: auto` on the content div makes only the content area scrollable

Result: **Header stays fixed at top, footer stays at bottom, content scrolls in between.**

```
┌─────────────────────┐
│    Header (sticky)   │
├─────────────────────┤
│                     │
│   Content (scrolls) │  ← main flex: 1 + page overflow-y: auto
│                     │
│                     │
├─────────────────────┤
│   Footer (sticky)   │  ← flex-shrink: 0
└─────────────────────┘
```

---

## Adding to a New Page

No per-page work needed. The layout is applied once in the controller:

```tsx
// In controller.tsx
render(
  <Layout currentPath={path}>
    <MyPage />
  </Layout>,
)
```

The `Layout` wraps your page in `<Document>` (which provides the flex `<body>`) and the shell (header + nav + scrollable content + footer).

---

## ⚠️ Gotchas

- **Body style collides with inline `<body>` mix** — Because `document.tsx` uses `mix={css({...})}` with inline values, you CANNOT add another `mix` prop to `<body>` elsewhere. All body-level styles belong in `document.tsx`.
- **Theme token references** — Body styles use `themeTokens` (aliased import) because they're in `document.tsx` which imports from `remix/ui/theme`. The `theme` object from `createTheme()` is NOT used directly here.
- **Body margin reset** — `margin: 0` on `<body>` is required for the flex layout to work correctly; otherwise the body has 8px default margin.

---

## 📂 Codebase References

- **Document**: `app/ui/document.tsx` — Body flex container + theme-driven styles
- **Layout**: `app/ui/layout.tsx` — Shell with header, scrollable main, footer
- **Consumer**: `app/actions/controller.tsx` — All routes use `<Layout>`

## Related

- [App architecture](../concepts/architecture.md) — Layout file ownership and key decisions
- [Page primitives](page-primitives.md) — Content components used inside the layout
- [Remix 3 layout patterns](../../development/remix3/ui/guides/layout.md) — General layout concepts
- [Remix 3 app layout](../../development/remix3/ui/guides/app-layout.md) — App shell best practices
