<!-- Context: development/remix3/guides/client-entry-side-effects | Priority: high | Version: 2.0 | Updated: 2026-05-07 -->

# Side-Effect-Only clientEntry

**Purpose**: Use `clientEntry()` components purely for client-side side effects (SSE listeners, DOM interception) without rendering visible UI.

## Modern Pattern (Recommended): queueTask + handle.signal

The modern approach uses `handle.queueTask()` for one-time setup and `{ signal: handle.signal }` for automatic event listener cleanup — no `initialized` flag, no `typeof document` guard needed.

```typescript
import { clientEntry, type Handle } from 'remix/ui'

export const GridClient = clientEntry(
  import.meta.url,
  function GridClient(handle: Handle) {
    return () => {
      // queueTask ensures DOM is ready — runs once after mount
      handle.queueTask(() => {
        document.addEventListener('dblclick', (e) => {
          let cell = (e.target as HTMLElement).closest('[data-editable]')
          if (!cell) return
          // ... edit logic ...
        }, { signal: handle.signal })
        // ^^ Listener auto-removed when component unmounts

        document.addEventListener('click', (e) => {
          let btn = (e.target as HTMLElement).closest('[data-pagination]')
          if (!btn) return
          // ... pagination logic ...
        }, { signal: handle.signal })
      })

      return null  // No visible UI
    }
  },
)
```

**Key advantages**:
- `queueTask(fn)` runs the function **once** after the component is mounted in the DOM — no need for `initialized` flag
- `{ signal: handle.signal }` auto-aborts all listeners when the component unmounts or frame reloads — no cleanup code needed
- Server-rendered components never call `queueTask` — no SSR crash, no `typeof document` guard needed
- Survives frame navigation because `handle.signal` is tied to the clientEntry lifetime

## Legacy Pattern (Old): initialized Flag

The older approach uses a module-level `initialized` flag with manual cleanup. Prefer `queueTask + handle.signal` for new code.

```typescript
import { clientEntry, type Handle } from 'remix/ui'

export const MyClient = clientEntry(
  import.meta.url,
  function MyClient(handle: Handle<{ containerId: string }>) {
    let initialized = false

    return () => {
      let { containerId } = handle.props
      if (!initialized && typeof document !== 'undefined') {
        initialized = true

        let eventSource = new EventSource('/events/subscribe')
        eventSource.addEventListener('message', (event) => {
          let container = document.getElementById(containerId)
          if (container) { /* update DOM */ }
        })

        let form = document.getElementById('my-form') as HTMLFormElement | null
        if (form) {
          form.addEventListener('submit', (e) => {
            e.preventDefault()
            let data = new FormData(form!)
            fetch(form!.action, { method: 'POST', body: data, redirect: 'manual' })
          })
        }
      }

      return null
    }
  },
)
```

## Pattern Comparison

| Concern | Legacy (`initialized` flag) | Modern (`queueTask + signal`) |
|---------|----------------------------|-------------------------------|
| One-time init | `let initialized = false` + `if (!initialized)` guard | Built into `queueTask()` |
| SSR safety | `typeof document !== 'undefined'` | Not needed — queueTask skips SSR |
| Cleanup | Manual `eventSource.close()` or AbortController | Automatic via `handle.signal` |
| Re-render guard | Manual | Built in |
| Frame navigation | Listeners survive but may leak | Listeners cleanly removed via signal |

## Key Points

| Concern | Pattern |
|---------|---------|
| **Render output** | Return `null` — component has no visual DOM output |
| **One-time init** | `handle.queueTask(fn)` — runs once after DOM mount (modern); or module-level `let initialized = false` (legacy) |
| **SSR safety** | Built into `queueTask` (modern); `typeof document !== 'undefined'` guard (legacy) |
| **DOM access** | `document.getElementById()` or `e.target.closest()` + `addEventListener()` with `{ signal: handle.signal }` |
| **Form interception** | `fetch(..., { redirect: 'manual' })` — avoids full page navigation that would kill SSE |

## Rules

1. **Return `null`** — Server renders the UI; clientEntry only adds behavior.
2. **Use `queueTask` (modern) or `initialized` flag (legacy)** — Guards against re-registration on re-renders
3. **`document.addEventListener` with `closest()` + `{ signal: handle.signal }`** — Survives DOM swaps, auto-cleans on unmount
4. **Server-rendered UI elements** — Buttons, forms, containers exist in initial HTML; clientEntry finds them by data-attributes
5. **No `typeof document` guard needed** with `queueTask` — it only runs client-side

## When to Use

| Scenario | Alternative | Why clientEntry wins |
|----------|-------------|---------------------|
| SSE listeners | Server-rendered `<script>` tags | clientEntry has proper lifecycle, access to Remix context |
| DOM event interception | Inline event attributes | Clean separation, module-scoped state |
| Third-party widget init | Window-level `onload` | Controlled initialization tied to component mount |
| Observer/ResizeObserver | Manual lifecycle management | Cancel callback handles cleanup |

## Anti-Patterns

- ❌ **Rendering UI elements inside clientEntry** — Causes layout shifts (server renders nothing → client adds elements), FOUC, and lost styling (CSS mixins not applied during server pass). Server-render all UI; clientEntry only adds behavior.
- ❌ Putting side effects in a visible component that also renders UI — keeps concerns mixed
- ❌ Omitting the `initialized` flag — side effects fire on every re-render
- ❌ Omitting `typeof document !== 'undefined'` — crashes during SSR
- ❌ Using `on('click', handler)` for DOM elements rendered outside the clientEntry — use `addEventListener` with `document.getElementById()` instead
- ❌ Allowing form submissions to navigate normally — kills EventSource connections

## Asset Server Registration

Every `clientEntry` file must be added to the asset server's `allow` list in the `createAssetServer` config. Missing entries cause silent 404 on hydration — no console error, the component just fails to load.

```typescript
createAssetServer({
  allow: [
    'app/assets/**',
    'app/ui/my-client-entry.tsx',  // clientEntry file must be listed
  ],
})
```

## Related

- `guides/client-entry-routes.md` — clientEntry with visible UI (full-page routes)
- `guides/sse-in-frames.md` — SSE within a Frame using this pattern
- `concepts/client-entry-typing.md` — clientEntry prop typing conventions
- `concepts/ssr-client-boundary.md` — Architectural SSR limitation and how clientEntry bridges it
- `errors/client-entry-issues.md` — Common clientEntry problems
- `guides/manual-fetch-patterns.md` — Manual fetch + event delegation when Frame reload is not ideal
- `guides/inline-editing-patterns.md` — Inline cell editing with queueTask + signal

## Codebase References

- `my_app/app/assets/grid-client.ts` — Modern queueTask + signal pattern for pagination, sorting, inline editing, delete
- `my_app/app/assets/messages-client.ts` — SSE listener + form interception, returns null
- `my_app/app/actions/messages/fragment-page.tsx` — Usage in a Frame fragment
