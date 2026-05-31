<!-- Context: project-intelligence/newapp/guides | Priority: high | Version: 1.0 | Updated: 2026-05-21 -->

# Handle Pattern Migration

## Overview

18 components across 19 files were migrated from the **factory pattern** to the **canonical Handle pattern**. This aligns with the remix 3 component model where `handle.props` is stable across updates.

## The Two Patterns

### ❌ Old Factory Pattern

```tsx
function MyComponent() {
  return (props: MyComponentProps) => (
    <div>{props.title}</div>
  )
}
```

**Problems:**
- Props object is created fresh every render — identity changes
- Cannot access `handle` in the setup phase (event listeners, SDK init)
- No access to `handle.signal` for cleanup
- Inconsistent with the `Handle`-based component model

### ✅ Canonical Handle Pattern

```tsx
function MyComponent(handle: Handle<MyComponentProps>) {
  return () => {
    let { title } = handle.props
    return <div>{title}</div>
  }
}
```

**Advantages:**
- `handle.props` identity is stable across updates (values refresh before render)
- Setup phase can initialize state, event listeners, SDK instances
- `handle.signal` provides automatic cleanup on unmount
- Consistent with the remix 3 `Handle<Props>` component model

## Migration Steps

### 1. Add Handle import
```tsx
import type { Handle } from 'remix/ui'
```

### 2. Change function signature
```diff
-function MyComponent() {
-  return (props: MyComponentProps) => (
+function MyComponent(handle: Handle<MyComponentProps>) {
+  return () => {
+    let { /* destructure props */ } = handle.props
+    return (
```

### 3. Close the render function
```diff
+    )
+  }
 }
```

### 4. Test file: use `makeHandle` helper
```ts
function makeHandle<P>(props: P): Handle<P> {
  return { id: 'test', props } as unknown as Handle<P>
}

// Usage:
let renderFn = MyComponent(makeHandle({ title: 'Hello' }))
let tree = renderFn()
```

## Before/After Examples

### Component: `ForbiddenPage`

**Before:**
```tsx
export function ForbiddenPage() {
  return ({ message = "You don't have admin access." }: ForbiddenPageProps) => (
    <div mix={pageCss}>
      <h1 mix={titleCss}>403</h1>
      <p mix={messageCss}>{message}</p>
    </div>
  )
}
```

**After:**
```tsx
export function ForbiddenPage(handle: Handle<ForbiddenPageProps>) {
  return () => {
    let message = handle.props.message ?? "You don't have admin access."
    return (
      <div mix={pageCss}>
        <h1 mix={titleCss}>403</h1>
        <p mix={messageCss}>{message}</p>
      </div>
    )
  }
}
```

### Component: `ClientPage`

**Before:**
```tsx
function ClientPage() {
  return ({ frameSrc, editRow, creating = false }: ClientPageProps) => {
    // ...render
  }
}
```

**After:**
```tsx
function ClientPage(handle: Handle<ClientPageProps>) {
  return () => {
    let { frameSrc, editRow, creating = false } = handle.props
    // ...render
  }
}
```

### Test: `grid-page.test.ts`

**Before:**
```tsx
let renderFn = ClientGridPage()
let tree = renderFn({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true })
```

**After:**
```tsx
function makeHandle<P>(props: P): Handle<P> {
  return { id: 'test', props } as unknown as Handle<P>
}

let renderFn = ClientGridPage(makeHandle({ rows: sampleRows, offset: 0, hasPrev: false, hasNext: true }))
let tree = renderFn()
```

## The `makeHandle<P>` Helper

In test files, use the `makeHandle` pattern to construct a minimal handle:

```ts
function makeHandle<P>(props: P): Handle<P> {
  return { id: 'test', props } as unknown as Handle<P>
}
```

The `as unknown as Handle<P>` cast is needed because `Handle` has required fields (`update`, `queueTask`, `frame`, `frames`, `context`, `signal`) that aren't needed for render-only testing.

### Key testing change
- **Old**: Component returns a render function that takes props → call `renderFn(props)`
- **New**: Component takes a Handle → call `component(makeHandle(props))` to get render function, then `renderFn()` with no args

## Migrated Files

### Core components (17 files, factory → Handle)
| File | Component |
|------|-----------|
| `app/actions/auth-login-controller.tsx` | `LoginPage` |
| `app/actions/auth-register-controller.tsx` | `RegisterPage` |
| `app/actions/client/create-page.tsx` | `ClientCreatePage` |
| `app/actions/client/edit-page.tsx` | `ClientEditPage` |
| `app/actions/client/grid-page.tsx` | `ClientGridPage` |
| `app/actions/client/page.tsx` | `ClientPage` |
| `app/ui/admin-chatlog-page.tsx` | `ChatLogPage` |
| `app/ui/admin-fragments/chatlog-detail-fragment.tsx` | `ChatlogDetailFragment` |
| `app/ui/admin-fragments/recent-activity-fragment.tsx` | `RecentActivityFragment` |
| `app/ui/admin-fragments/stats-fragment.tsx` | `StatsFragment` |
| `app/ui/admin-fragments/user-detail-fragment.tsx` | `UserDetailFragment` |
| `app/ui/admin-lists-page.tsx` | `AdminListsPage` |
| `app/ui/agent-page.tsx` | `AgentPage` |
| `app/ui/ai-fragments/agent-result-fragment.tsx` | `AgentResultFragment` |
| `app/ui/chat-page.tsx` | `ChatPage` |
| `app/ui/document.tsx` | `Document` |
| `app/ui/forbidden-page.tsx` | `ForbiddenPage` |
| `app/ui/grid-state-hidden.tsx` | `GridStateHiddenInputs` |

### Test files updated (2 files)
| File | Change |
|------|--------|
| `app/actions/client/edit-page.test.ts` | Added `makeHandle`, updated all test calls |
| `app/actions/client/grid-page.test.ts` | Added `makeHandle`, updated all test calls |

## The `Handle<Props>` Type

From `remix/ui`:

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | Stable instance identifier |
| `props` | `Props` | Stable identity, values refresh before each render |
| `context` | `Context<ContextValue>` | Tree-based context (clientEntry only) |
| `update()` | `() => Promise<AbortSignal>` | Schedules re-render |
| `queueTask(task)` | `(task: Task) => void` | Runs task after next render |
| `frame` | `FrameHandle` | Component's closest frame |
| `frames` | `{ top: FrameHandle, get(name): FrameHandle \| undefined }` | Named frame access |
| `signal` | `AbortSignal` | Aborted on unmount (auto-cleanup) |

## Reference

- [Component Model](../../../../development/remix3/ui/concepts/component-model.md) — two-phase setup/render model
- [Handle API](../../../../development/remix3/ui/guides/handle-api.md) — Handle methods and usage
- [Component Patterns](../../../../development/remix3/ui/guides/component-patterns.md) — General component best practices
