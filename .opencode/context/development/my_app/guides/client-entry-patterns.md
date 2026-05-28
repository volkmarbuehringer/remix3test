<!-- Context: development/my_app/guides/client-entry-patterns | Priority: high | Version: 1.0 | Updated: 2026-05-06 -->

# ClientEntry Patterns in my_app

**Core Idea**: Four clientEntry components in `my_app` use a consistent side-effect-only pattern (`return null`, `document.addEventListener`, `initialized` guard) to add browser interactivity to server-rendered UI. One approach was reverted back to inline script.

---

## The Working Pattern

Every successful clientEntry in my_app follows this structure:

```typescript
import { clientEntry, type Handle } from 'remix/ui'

export const MyComponent = clientEntry(
  '/assets/app/ui/my-component.tsx#MyComponent',
  function MyEntry(handle: Handle) {
    let initialized = false

    return () => {
      if (!initialized && typeof document !== 'undefined') {
        initialized = true
        // --- Register event listeners ONCE ---
        document.addEventListener('click', (e) => {
          let target = (e.target as HTMLElement).closest('[data-trigger]')
          if (!target) return
          // ... side effect logic
        })
      }
      return null  // UI is server-rendered; this adds behavior only
    }
  },
)
```

### Rules
| Rule | Why |
|------|-----|
| **Return `null`** | Server renders the UI; clientEntry only adds behavior. Rendering UI here causes SSR mismatch and layout shifts. |
| **`initialized` flag** | Re-renders (`handle.update()`) would re-register listeners without it. |
| **`typeof document !== 'undefined'`** | Guards against SSR crash — clientEntry render function runs on server too. |
| **`document.addEventListener` with delegation** | `closest()` pattern survives DOM swaps from Frame/page navigation. |
| **Server-rendered UI elements** | Buttons, forms, containers exist in initial HTML — clientEntry finds them by ID. |

---

## Four Implementations

### 1. Theme Toggle — `app/ui/theme-toggle.tsx`
- **Trigger**: Click `#theme-toggle` button (server-rendered in `layout.tsx`)
- **Behavior**: Toggles `data-theme` on `<html>`, updates `localStorage` + cookie
- **Cookie format**: `theme=dark; path=/; max-age=31536000; SameSite=Lax` — matches server read in `document.tsx:17` (`getThemeFromCookie()`)
- **File ref**: `my_app/app/ui/theme-toggle.tsx`
- **Allow list**: Added to `controller.tsx:10`

### 2. ScrollToTop — `app/ui/scroll-to-top.tsx`
- **Trigger**: On mount (no user gesture needed)
- **Behavior**: Double `requestAnimationFrame` scrolls `#messages-container` to top — double rAF ensures layout is settled
- **File ref**: `my_app/app/ui/scroll-to-top.tsx`
### 3. FormLoadingState — `app/ui/form-loading-state.tsx`
- **Trigger**: `submit` event on `#chat-form`, `#agent-form`, or `#workflow-form`
- **Behavior**: Disables submit button, adds `.is-loading` class, updates loading text for workflow form
- **Scope**: Scoped to specific form IDs — NOT a global handler
- **File ref**: `my_app/app/ui/form-loading-state.tsx`
- **Replaces**: Inline scripts at `chat/page.tsx:336`, `agent/page.tsx:182`, `workflow/page.tsx:531`

### 4. WorkflowParameters — `app/ui/workflow-parameters.tsx`
- **Trigger**: `change` on `#workflow-select`
- **Behavior**: Parses `data-parameters` JSON from selected `<option>`, builds dynamic form inputs via DOM `createElement`
- **Replaces**: Inline script at `workflow/page.tsx:461`
- **File ref**: `my_app/app/ui/workflow-parameters.tsx`

---

## Anti-Pattern: Rendering UI in clientEntry

❌ **What was tried**: Rendering `<Button>` and other UI elements inside clientEntry's render function.

**Why it breaks**: clientEntry's render function is called on both server and client. On the server, clientEntry returns `null` (it's designed for client-only hydration). This causes:
- Layout shifts (server renders nothing → client suddenly adds elements)
- Button styling lost (CSS mixins not applied during server pass)
- FOUC/flash of missing UI elements

✅ **Fix**: Server-render all UI elements. clientEntry finds them by ID via `document.getElementById()` or delegates events via `closest()`.

---

## Reverted: Hamburger Menu

**What**: clientEntry with 4 event listeners (toggle, scrim click, Escape key, link click) manipulating `style.display` and `aria-expanded`.

**Why reverted**: Caused subtle issues in unrelated client-rendered pages. Risk/reward not worth the migration for a simple toggle.

**Status**: Still inline at `app/ui/layout.tsx:184`.

---

## What Must Stay Inline

| Script | File:Line | Reason |
|--------|-----------|--------|
| Dark mode CLS prevention | `app/ui/document.tsx:51` | Must run synchronously in `<head>` before first paint. `localStorage` read + `data-theme` set cannot be deferred to clientEntry. |

Server sets `data-theme` from cookie (`document.tsx:34`); on first visit (no cookie) the inline IIFE reads `localStorage` to prevent theme flash.

---

## SSR Architectural Limitation

**Server renders identical HTML for all clients** — it does not know the viewport size.

- CSS media queries handle visual adaptation (e.g., `@media (max-width: 768px)`)
- But interactive behavior tied to layout state (hamburger open/closed, pagination page size) fundamentally requires client-side logic
- This is inherent to SSR — cannot be fully solved without client-side state

**Impact on my_app**: The hamburger menu toggle, pagination controls, and any viewport-dependent interactivity will always need client-side JS (inline or clientEntry).

---

## Asset Server Registration

Every clientEntry file **must** be added to the `allow` list in `app/actions/controller.tsx:10`. Missing entries cause silent 404 on hydration with no console error. Current clientEntry entries:

```
app/ui/theme-toggle.tsx · app/ui/scroll-to-top.tsx
app/ui/form-loading-state.tsx · app/ui/workflow-parameters.tsx
app/ui/prompt-button.tsx · app/ui/toast.tsx
```

---

## 📂 Codebase References

- `my_app/app/ui/theme-toggle.tsx` — Theme toggle clientEntry
- `my_app/app/ui/scroll-to-top.tsx` — ScrollToTop clientEntry
- `my_app/app/ui/form-loading-state.tsx` — Form loading state clientEntry
- `my_app/app/ui/workflow-parameters.tsx` — Workflow parameters clientEntry
- `my_app/app/ui/layout.tsx:184` — Hamburger inline script (intentionally kept)
- `my_app/app/ui/document.tsx:51` — Dark mode inline script (must stay sync)
- `my_app/app/actions/controller.tsx:10` — Asset server allow list
- `my_app/app/assets/entry.ts` — Entry module with `run()` and form confirm interceptor

## Related

- `../../../remix3/ui/guides/client-entry-side-effects.md` — General side-effect-only pattern (canonical reference)
- `../../../remix3/ui/guides/client-interactivity-patterns.md` — Inline vs clientEntry decision guide
- `../../../remix3/errors/client-entry-issues.md` — Common clientEntry problems
- `../../project-intelligence/my_app/guides/ui-component-patterns.md` — Component inventory including clientEntry
- `../../project-intelligence/my_app/errors/inline-script-limitations.md` — When inline scripts fail
