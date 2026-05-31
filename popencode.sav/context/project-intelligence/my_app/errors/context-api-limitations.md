<!-- Context: project-intelligence/my_app/errors/context-api-limitations | Priority: high | Version: 1.0 | Updated: 2026-05-05 -->

# Error Reference: Remix 3 Context API Limitations

**Purpose**: Document what the Remix 3 `handle.context` Context API does and does NOT support. Established during the `adopt-remix-ui-patterns` change when `AppStateProvider`/`ThemeProvider` were introduced.

---

## 1. Context API Only Works with `clientEntry` Components

**Symptom**: Server-rendered components wrapped in a Context Provider do not receive context values. Child components accessing `handle.context` get `undefined` or the default value.

**Root cause**: The `handle.context` mechanism is a **clientEntry-only** feature. It wires into the component lifecycle that only exists for components registered via `clientEntry()`. Server-rendered components (factory functions that return a render function) have no client-side lifecycle and therefore no context subscription.

**What this means**:
- `AppStateProvider` and `ThemeProvider` in `app/ui/context-providers.tsx` are currently **pass-through wrappers** — they return children as-is because there are no `clientEntry` consumers yet
- If a future `clientEntry` component needs app state (user info, theme), the provider pattern is ready
- Server components must extract data directly from `getContext()` or pass it as props

---

## 2. Server Components: Use `getContext()` Not `handle.context`

```typescript
// ✅ CORRECT: Server component reads auth/theme from async context
import { getContext } from 'remix/async-context-middleware'
import { getCurrentUserSafely } from '../../utils/context.ts'

function MyPage() {
  return () => {
    let user = getCurrentUserSafely()  // reads from async context
    // ... render with user data
  }
}
```

```typescript
// ❌ WRONG: Server component trying to use handle.context
function MyPage() {
  return (handle: Handle) => {
    let ctx = handle.context  // undefined or empty in SSR
    // ...
  }
}
```

---

## 3. `Handle` Type is Available from `remix/ui`

The `Handle` type IS available from `remix/ui` and is used in `clientEntry` components:

```typescript
import { clientEntry, type Handle } from 'remix/ui'

export const GridClient = clientEntry(
  import.meta.url,
  function GridClient(handle: Handle) {
    // handle.context would work here (clientEntry context)
    return () => {
      // side effects setup
      return null
    }
  },
)
```

This is the **correct usage** — `Handle` is received as a parameter in `clientEntry` factory functions.

---

## 4. `remix/component` Package Does NOT Exist

**Discovery**: The `remix/component` package referenced in some documentation **has been removed**. There is no `component()` function to wrap server components for Context API access.

`remix/ui` current exports: `Fragment`, `Frame`, `TypedEventTarget`, `addEventListeners`, `attrs`, `clientEntry`, `createElement`, `createMixin`, `createRangeRoot`, `createRoot`, `createScheduler`, `css`, `link`, `navigate`, `on`, `ref`, `run`

---

## 5. Current State of Context Providers

`app/ui/context-providers.tsx` defines two providers used in `document.tsx`:

```tsx
// context-providers.tsx
export interface AppState { user: User | null; isAuthenticated: boolean; currentPath: string }
export interface ThemeMode { mode: 'light' | 'dark' }

export function AppStateProvider() {
  return ({ children }: ProviderProps) => children  // pass-through
}

export function ThemeProvider() {
  return ({ children }: ProviderProps) => children  // pass-through
}
```

```tsx
// document.tsx usage
<body>
  <AppStateProvider>
    <ThemeProvider>
      {children}
      <ToastContainer />
    </ThemeProvider>
  </AppStateProvider>
</body>
```

**These are scaffolding** — ready for future `clientEntry` consumers that need typed app state and theme context.

---

## Verification

- 88/88 tests pass, 0 typecheck errors after introducing providers
- No breaking changes — both providers return children as-is
- Context wiring is ready for future `clientEntry` components

---

## 📂 Codebase References

- Providers: `my_app/app/ui/context-providers.tsx`
- Document shell: `my_app/app/ui/document.tsx` (lines 78–83)
- clientEntry examples: `my_app/app/assets/grid-client.ts`, `my_app/app/ui/toast.tsx`, `my_app/app/ui/prompt-button.tsx`
- `remix/ui` exports: `remix/ui` (remix package)
- Async context: `my_app/app/middleware/` (session, auth, database loaders)

## Related

- `../errors/inline-script-limitations.md` — Why inline scripts fail for component interactivity
- `development/remix3/errors/client-entry-issues.md` — Common clientEntry problems
- `development/remix3/guides/client-interactivity-patterns.md` — clientEntry vs inline script decision guide
- `../concepts/architecture.md` — Middleware chain for server-side context
