<!-- Context: project-intelligence/my_app/guides/ui-component-patterns | Priority: high | Version: 1.3 | Updated: 2026-05-06 -->

# UI Component Patterns

**Core Idea**: The my_app project builds UI using `css()` mixins with `theme.*` tokens from `remix/ui/theme`, a shared mixin library at `app/ui/mixins/`, `clientEntry` for interactive components, and inline `<script>` tags only for document-level event delegation.

---

## Component Inventory

| Component | File | Pattern | Interactive | Theme Tokens |
|-----------|------|---------|-------------|--------------|
| SkeletonLine/SkeletonCard | `app/ui/skeleton.tsx` | Server component | No | Yes |
| ToastContainer | `app/ui/toast.tsx` | clientEntry + pub/sub + `Button tone="ghost"` + `animateExit` | Yes — `on('click')` | Yes |
| Hamburger menu | `app/ui/layout.tsx` | Inline script delegation, `Button tone="ghost"` for nav | Yes — event delegation | No |
| PromptButton | `app/ui/prompt-button.tsx` | clientEntry state machine, `Button tone="ghost"` + `style` overrides | Yes — `on('click')` | No (uses `var(--)`) |
| Auth styles | `app/ui/auth-styles.ts` | Exported css() mixins (`btnStyle` removed — covered by `Button tone="primary"`) | No | Yes |
| **Mixin Library** | `app/ui/mixins/` | 14 reusable css() mixins in 4 files (button, card, input, text) | No | Yes |
| **Context Providers** | `app/ui/context-providers.tsx` | AppStateProvider + ThemeProvider pass-through wrappers | No (future clientEntry) | No |

---

## Mixin Library (`app/ui/mixins/`)

14 reusable `css()` mixins organized by element type. Import only what you need:

```typescript
import { textMuted } from './mixins/text.ts'
import { cardBase, cardHover } from './mixins/card.ts'
```

| File | Mixins | Used In |
|------|--------|---------|
| `button.ts` | `buttonBase`, `buttonPrimary`, `buttonGhost`, `buttonDanger` | Reference implementations for Button tone mapping |
| `card.ts` | `cardBase`, `cardHover`, `cardSelected` | Container panels, lists |
| `input.ts` | `inputBase`, `inputFocus`, `inputError` | Form inputs |
| `text.ts` | `textHeading`, `textBody`, `textMuted`, `textLabel` | Typography (layout.tsx footer uses `textMuted`) |

**Key convention**: Action color properties use `foreground` not `text`, `backgroundHover` not `hover`:
- `theme.colors.action.primary.foreground` ✅ (not `.text` ❌)
- `theme.colors.action.primary.backgroundHover` ✅ (not `.hover` ❌)

See `../concepts/mixin-architecture.md` for architecture and `../guides/css-mixin-usage.md` for step-by-step how-to.

## Context Providers (`app/ui/context-providers.tsx`)

Two pass-through wrappers inserted in `document.tsx` body:

```tsx
// document.tsx
<body>
  <AppStateProvider>
    <ThemeProvider>
      {children}
      <ToastContainer />
    </ThemeProvider>
  </AppStateProvider>
</body>
```

**Important**: `handle.context` only works with `clientEntry` components, not server-rendered components. These providers are scaffolding for future `clientEntry` consumers. Server components should use `getContext()` directly.

See `../errors/context-api-limitations.md` for full details.

---

## Skeleton Components (`skeleton.tsx`)

CSS pulse animation with theme tokens. Used as Frame fallback on Messages page.

```typescript
const skeletonBaseStyle = css({
  background: theme.surface.lvl2,
  borderRadius: theme.radius.md,
  animation: 'skeletonPulse 1.5s ease-in-out infinite',
  '@keyframes skeletonPulse': {
    '0%, 100%': { opacity: 1 },
    '50%': { opacity: 0.35 },
  },
})

export function SkeletonCard() {
  return () => (
    <div mix={css({ padding: theme.space.lg, background: theme.surface.lvl1, borderRadius: theme.radius.lg, border: `1px solid ${theme.colors.border.default}` })}>
      <SkeletonLine width="40%" />
      <SkeletonLine width="80%" />
    </div>
  )
}
```

**Key patterns**:
- `@keyframes` inside `css()` — Remix 3's CSS-in-JS hoists it to a `<style>` tag
- Plain Remix functions (not clientEntry) — no hydration needed for loading states
- Frame fallback: `<Frame src={fragmentSrc} fallback={<SkeletonCard />} />`

---

## Remix Frame Components

Frame components (`<Frame>` from `remix/ui`) are used for SSR fragment rendering in my_app (e.g., Messages page, client grid fallback).

### Embedded Frame Constraint
For Frames rendered inside a page layout (embedded Frames), **never use `handle.frames.top.reload()`** to update content. This method triggers Remix's full document reload path, which crashes with `DOMException: Cannot have more than one Element child of a Document` (the parent Document already has an `<html>` element).

Always use the `fetchPage()` pattern for embedded Frame updates: manually fetch the fragment URL, strip the full HTML wrapper, and update the container innerHTML. See [Embedded Frame Reload Gotcha](../errors/embedded-frame-reload-gotcha.md) for full details.

### Usage Pattern
```tsx
// Embedded Frame with Skeleton fallback (SSR)
<Frame name={frames.clientEdit} src="/client/edit-fragment/123" fallback={<SkeletonCard />} />
```

---

## Toast Notification System (`toast.tsx`)

Module-level pub/sub state with a `clientEntry` container. This is the **current my_app implementation** (distinct from the CustomEvent-based approach in `development/remix3/concepts/toast-system.md`).

**Architecture**: Module-level `toasts[]`, `listeners[]`, `timers` map → `ToastContainer` clientEntry subscribes and renders on `handle.update()`.

**Usage**:
```typescript
import { showToast } from '../ui/toast.tsx'

// In a clientEntry click handler:
showToast('success', 'Item saved')
showToast('error', 'Failed to save', 6000)  // custom duration
```

**Key patterns**:
- Module-level state shared across all instances — no Context API
- `subscribe()` + `notify()` triggers `handle.update()` without prop drilling
- Dark mode detected at toast creation via `document.documentElement.getAttribute('data-theme')`
- `MAX_TOASTS = 5` cap; auto-dismiss via `setTimeout` (default 4s)
- Dismiss button: `on('click', () => dismissToast(t.id))`

---

## Hamburger Menu (`layout.tsx`)

Responsive navigation at ≤768px breakpoint using inline `<script>` with document-level event delegation.

**Why not clientEntry?** Non-stateful toggle rendered in server HTML. Inline script is simpler — no extra hydration config needed.

**Implementation**:
```html
<script>{`
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('#hamburger-btn');
    if (!btn) return;
    var panel = document.getElementById('mobile-nav-panel');
    var overlay = document.getElementById('mobile-nav-overlay');
    var isOpen = panel.style.display === 'flex';
    panel.style.display = isOpen ? 'none' : 'flex';
    overlay.style.display = isOpen ? 'none' : 'block';
    btn.setAttribute('aria-expanded', String(!isOpen));
  });
  // Close on scrim click
  document.addEventListener('click', function(e) {
    if (e.target.id !== 'mobile-nav-overlay') return;
    panel.style.display = 'none'; overlay.style.display = 'none';
  });
  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key !== 'Escape') return;
    panel.style.display = 'none'; overlay.style.display = 'none';
  });
  // Close on link click
  document.getElementById('mobile-nav-panel').addEventListener('click', function(e) {
    if (!e.target.closest('a')) return;
    panel.style.display = 'none'; overlay.style.display = 'none';
  });
`}</script>
```

**CSS**: `hamburgerStyle` (hidden desktop → flex ≤768px), `desktopNavStyle` (visible → hidden), `mobileNavPanelStyle` (hidden → JS-toggled column), scrim at z-index 98.

---

## PromptButton (`prompt-button.tsx`)

Clipboard copy button with a 4-state lifecycle (`idle → copied → resetting → idle`).

**Key patterns**: `on('click', handler)` with `signal`, `handle.update()` for re-renders, `var(--*)` for theming (legacy — prefer `theme.*`).

---

## Auth Styles (`auth-styles.ts`)

Exported `css()` mixins for login/register forms using `theme.*` tokens. The `btnStyle` export was removed during the Button adoption migration — login/register forms now use `<Button tone="primary">` directly, which covers all button styling needs.

**Remaining exports**: `authCardStyle`, `cardStyle`, `formGroupStyle`, `alertErrorStyle`, `demoAccountsStyle`, `linkStyle` — all still in active use.

---

## CSS Variable → Theme Token Migration

Recent work replaced `var(--rmx-*)` / `var(--*)` with typed `theme.*` tokens:

| Before | After | File |
|--------|-------|------|
| `var(--border-default, #e2e8f0)` | `theme.colors.border.default` | `admin/lists/index-page.tsx` |
| `var(--surface-lvl1, #f8fafc)` | `theme.surface.lvl1` | `admin/lists/index-page.tsx` |
| `var(--text-primary, #0f172a)` | `theme.colors.text.primary` | `ui/auth-styles.ts` |
| Inline `style={{}}` | Named `css()` mixins | `admin/lists/index-page.tsx` |

**Migration approach**: Replace `var(--rmx-*)` → `theme.*` path lookup; extract inline `style={{}}` to named `css()` mixins.

---

## 📂 Codebase References

- `my_app/app/ui/skeleton.tsx` — SkeletonLine, SkeletonCard
- `my_app/app/ui/toast.tsx` — ToastContainer, showToast/dismissToast
- `my_app/app/ui/layout.tsx` — Hamburger menu with inline script
- `my_app/app/ui/prompt-button.tsx` — Clipboard clientEntry
- `my_app/app/ui/auth-styles.ts` — Auth CSS with theme tokens
- `my_app/app/ui/mixins/button.ts` — Button mixins (buttonBase, buttonPrimary, buttonGhost, buttonDanger)
- `my_app/app/ui/mixins/card.ts` — Card mixins (cardBase, cardHover, cardSelected)
- `my_app/app/ui/mixins/input.ts` — Input mixins (inputBase, inputFocus, inputError)
- `my_app/app/ui/mixins/text.ts` — Text mixins (textHeading, textBody, textMuted, textLabel)
- `my_app/app/ui/context-providers.tsx` — AppStateProvider, ThemeProvider
- `my_app/app/actions/admin/lists/index-page.tsx` — Admin table css() with theme tokens
- `my_app/app/actions/controller.tsx` — Asset server allow list
- `my_app/app/ui/document.tsx` — ToastContainer, theme toggle, context provider wrapping

## Related
- `../concepts/button-tone-convention.md` — Button primitive tone mapping (all project buttons use this)
- `../concepts/mixin-architecture.md` — Mixin library architecture and theme naming conventions
- `../guides/css-mixin-usage.md` — How to create and compose mixins from the library
- `../guides/animation-adoption.md` — `animateEntrance`/`animateExit` usage patterns for fragment transitions
- `../errors/vdom-testing-gotchas.md` — Button type resolution, theme contract property names in tests
- `../errors/context-api-limitations.md` — handle.context only works with clientEntry
- `../errors/embedded-frame-reload-gotcha.md` — Embedded Frame reload crash constraint and workaround
- `development/remix3/guides/client-interactivity-patterns.md`
- `development/remix3/concepts/toast-system.md` — CustomEvent vs clientEntry
- `development/remix3/concepts/theme-contract.md`
