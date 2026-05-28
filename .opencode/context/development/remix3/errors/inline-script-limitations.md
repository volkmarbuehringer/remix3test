<!-- Context: development/remix3/errors/inline-script-limitations | Priority: high | Version: 1.0 | Updated: 2026-05-03 -->

# Error: Inline `<script>` Tags Unreliable for Component Interactivity

**Problem**: Inline `<script>` blocks inside server-rendered JSX do not reliably execute in the Remix 3 SSR rendering pipeline. This affects Fragment/Frame rendering and streaming response paths.

---

## Symptoms

- JavaScript inside a `<script>{`\`...\`}</script>` block never runs in the browser
- Expected DOM mutations or event listeners are missing
- The component appears server-rendered but has no client-side behavior
- Works in initial full-page load but breaks on Frame navigation

---

## Cause

The Remix 3 SSR pipeline may not emit or execute inline `<script>` tags consistently across all rendering paths. Specifically:

1. **Fragment/Frame rendering**: When a page section is rendered via `renderFragment()` (for Frame-based navigation), the `<script>` tag may be stripped or not executed
2. **Streaming responses**: The streaming HTML pipeline may split `<script>` blocks across chunks, breaking execution
3. **Component model**: Remix 3's `clientEntry`-based component model is designed to own all client-side behavior; inline scripts are a foreign element

---

## The Working Pattern: `clientEntry` + `on()`

```typescript
// ✅ CORRECT: clientEntry with mix={[on('click', handler)]}
import { clientEntry, on, type Handle } from 'remix/ui'

export const InteractiveButton = clientEntry(
  '/assets/app/ui/my-button.tsx#InteractiveButton',
  function InteractiveButton(handle: Handle) {
    return () => (
      <button
        mix={[on('click', async () => {
          // ... interactivity here
        })]}
      >
        Click me
      </button>
    )
  },
)
```

Plus register the file in the asset server allow list (`app/actions/controller.tsx`):
```typescript
allow: ['app/assets/**', 'app/ui/my-button.tsx', ...]
```

---

## Acceptable Inline Script Exceptions

Inline scripts **do** work reliably for these cases:

| Case | Reason |
|------|--------|
| **Document-level event delegation** | `document.addEventListener(...)` with `e.target.closest()` — attached once to document, survives DOM swaps |
| **Flash-prevention IIFE** in `<head>` | Runs synchronously before first paint, no dependency on rendering pipeline |
| **Simple loading indicators** via `getElementById()` | Toggles `display` property on elements that exist in initial HTML |
| **Theme toggle** via document-level delegation | Same as document-level delegation pattern |

**Common pattern for acceptable inline usage**:
```html
<script>{`
  document.addEventListener('click', function(e) {
    var btn = e.target.closest('#some-id');
    if (!btn) return;
    // ... handle interaction
  });
`}</script>
```

---

## Debugging Checklist

- [ ] Is the behavior attached to a `clientEntry` component? If not, that's likely the fix
- [ ] If using an inline `<script>`, is it using `document.addEventListener` with `e.target.closest()`?
- [ ] Is the script running on initial page load but failing on Frame navigation? → Use `clientEntry`
- [ ] Is the file path in the asset server `allow` list in `app/actions/controller.tsx`?
- [ ] Is the component using HTML event attributes (`onclick`, `onsubmit`)? → Those are invalid in Remix 3 TSX; use `mix={[on('...', handler)]}`

---

## 📂 Codebase References

**Affected patterns** (fixed):
- `my_app/app/ui/layout.tsx` — Hamburger menu uses inline script with document-level delegation (acceptable)
- `my_app/app/ui/document.tsx` — Theme toggle uses inline script with document-level delegation (acceptable)

**Correct patterns** (use these):
- `my_app/app/ui/prompt-button.tsx` — Clipboard clientEntry with `on('click', handler)`
- `my_app/app/ui/toast.tsx` — Toast dismiss with `on('click', handler)`

**Asset server**:
- `my_app/app/actions/controller.tsx` — allow list configuration

## Related
- `../guides/client-interactivity-patterns.md` — Pattern selection guide
- `../../../project-intelligence/my_app/guides/ui-component-patterns.md` — my_app UI component implementations
- `../guides/client-entry-side-effects.md` — Side-effect-only clientEntry
- `client-entry-issues.md` — Common clientEntry problems
