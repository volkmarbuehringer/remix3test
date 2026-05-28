<!-- Context: development/remix3/guides/frame-navigation-patterns | Priority: high | Version: 1.2 | Updated: 2026-05-18 -->

# Frame Navigation Patterns

**Purpose**: Frame detection, redirect following, streaming markers, and non-blocking frame patterns for Remix 3.

## 1. Frame Detection via X-Remix-Target

Check if rendering inside a frame by reading the `X-Remix-Target` header:

```typescript
import { getContext } from 'remix/async-context-middleware'
function isFrameRequest(): boolean {
  return getContext().request.headers.get('X-Remix-Target') !== null
}
function isTargetedFrame(name: string): boolean {
  return getContext().request.headers.get('X-Remix-Target') === name
}
```

Server-side: `resolveFrame` sets `x-remix-frame` and `x-remix-target` headers. Client-side `run()` config forwards them via `fetch()`.

**Use cases**: Different layout (minimal chrome inside frames), skip full-doc wrapper, conditional heavy assets.

## 2. Named Frames

Use `name` prop for programmatic lookup via `handle.frames`:

```typescript
<Frame name="sidebar" src="/sidebar" fallback={<div>Loading...</div>} />
<Frame name="main-content" src="/books" />

function NavButton(handle) {
  return () => <button onClick={async () => { await handle.frames.get('sidebar')?.reload() }}>Refresh</button>
}
```

- `handle.frames.get(name)` → `FrameHandle | undefined`
- `handle.frames.top` → root frame
- Named frames survive parent re-renders

## 3. Reload Scoping

| Method | Scope | Behavior |
|--------|-------|----------|
| `handle.frame.reload()` | Current frame | Re-fetches src, diffs DOM, preserves state |
| `handle.frames.get('name')?.reload()` | Named sibling | Reloads another frame by name |
| `handle.frames.top.reload()` | Full page | ⚠️ Only works for top-level frames; embedded frames crash with `DOMException` |

**⚠️ `top.reload()`** only works when `container.root instanceof Document`. Embedded `<div>` children crash. Use manual `fetch()` + `innerHTML` for embedded full-page reloads.

## 4. Frame Redirect Following

Frame resolution should follow HTTP redirects transparently (up to 10 hops):

```typescript
async function followFrameRedirects(router: Router, request: Request, url: string, headers: Headers): Promise<Response> {
  let redirectsRemaining = 10
  while (true) {
    let res = await router.fetch(new Request(url, { headers, signal: request.signal }))
    let location = res.headers.get('Location')
    if (!location || res.status < 300 || res.status >= 400) return res
    if (redirectsRemaining-- <= 0) throw new Error('Too many frame redirects')
    url = new URL(location, url).toString()
  }
}
```

**Integration**: Use in `resolveFrame` with full header forwarding (accept, cookie, x-remix-frame, x-remix-target). On error, return `<pre>Frame error: {status}</pre>`.

## 5. Frame Streaming Markers

HTML comment markers for the batch protocol:

| Marker | Purpose |
|--------|---------|
| `<!-- rmx:flush document -->` | Full document flush |
| `<!-- rmx:flush fragment -->` | Fragment flush (partial frame content) |
| `<!-- rmx:f:id -->` | Frame marker open (starts placeholder) |
| `<!-- /rmx:f -->` | Frame marker close (ends placeholder) |

Server streams frames within markers; client `run()` diffs and replaces. `resolveFrame` MUST return a string (not ReadableStream) — the inline template engine cannot pipe streams into HTML comment markers.

## 6. Non-Blocking (Client-Mounted) Frames

```typescript
<Frame src="/slow-data" />                              {/* blocking — waits */}
<Frame src="/slow-data" fallback={<div>Loading...</div>} />  {/* non-blocking — renders fallback first */}
```

**Flow**: Server renders fallback + `<!-- rmx:f:id -->` → Client mounts immediately → `resolveFrame()` fetches in background → DOM diff swaps fallback→real content → State preserved.

clientEntry components inside non-blocking frames survive full-document reloads. Frame hydration does not block parent page. Nested frames hydrate top-down.

## 7. Links Inside Sub-Frames Must Have `rmx-target`

**Every `<a>` element rendered inside a `<Frame>` must include `rmx-target`.** Without it, the navigation intercept defaults to the top-level Document frame, which crashes when loading fragment HTML. See `errors/fragment-navigates-top-frame.md` for the full call chain.

### Correct Patterns

```html
<!-- ✅ Named frame target (preferred for sub-frame navigation) -->
<a href="/admin/fragments/user-detail/101" rmx-target="admin-content">View details</a>

<!-- ✅ Full document navigation (intentional page transition) -->
<a href="/admin/user-detail/101" rmx-document>View details</a>

<!-- ✅ Non-navigating disclosure (no Navigation API involved) -->
<details>
  <summary>View details</summary>
  <Frame src="/admin/fragments/user-detail/101" fallback="Loading..." />
</details>
```

### Anti-Patterns

```html
<!-- ❌ DANGEROUS: No rmx-target inside a Frame — crashes on click -->
<a href="/admin/fragments/user-detail/101">View details</a>

<!-- ❌ BAD: <a> used as a button — no navigation intent but still intercepted -->
<a href="#" class="btn-like" onclick="toggleDetail()">View details</a>
```

## Related

- `errors/fragment-navigates-top-frame.md` — Detailed error analysis (missing rmx-target in sub-frames)
- `ui/guides/frame-resolution.md` — resolveFrame mechanics (server + client)
- `ui/guides/frames.md` — Frame component API
- `ui/guides/handle-api.md` — Reload methods and limitations
- `ui/guides/hydration-frames-navigation.md` — Hydration overview

## Codebase References

- `newapp/app/middleware/render.tsx` — `followFrameRedirects`, `resolveFrame()` with redirect following
- `newapp/app/assets/entry.tsx` — Client-side `resolveFrameResponse` with 401 detection
- `demos/frame-navigation/app/actions/render.tsx` — Original reference implementation

### Frame Detection Headers Quick Ref

| Header | Set By | Purpose |
|--------|--------|---------|
| `X-Remix-Frame: true` | `resolveFrame` (both server + client) | Marks sub-request as frame resolution |
| `X-Remix-Target: <name>` | `resolveFrame` when `target` provided | Identifies the target frame name |
| `X-Remix-Frame` (read) | `requireAuth()` | Distinguishes frame requests for auth behavior (401 fragment vs redirect) |
