<!-- Context: development/remix3/ui/guides/client-entry-error-handling | Priority: high | Version: 1.0 | Updated: 2026-05-13 -->

# Client Entry Error Handling

**Purpose**: Error recovery patterns in the client entry module (`app/assets/entry.tsx`) — global error handler with fade-out animation, ErrorCard component, and 401 detection in frame resolution.

## Quick Reference

- **Use when**: Building or modifying the client entry bootstrap
- **Key components**: `ErrorCard`, `fadeOutBody()`, global `error` event listener, 401 handling in `resolveFrame`
- **File**: `app/assets/entry.tsx` (must be `.tsx` for JSX rendering)

## Pattern: Global Error Handler

Register an `error` event listener on the `app` instance returned by `run()`. On error, dispose the app, fade out the page, and render an ErrorCard:

```typescript
app.addEventListener('error', async (event) => {
  app.dispose()
  await fadeOutBody()

  let message = 'message' in event.error ? event.error.message : 'Unknown error'
  createRoot(document.body).render(
    <div mix={pageCss}>
      <ErrorCard
        eyebrow="Unexpected Error"
        title="Something went wrong"
        message={message}
        animated
        action={
          <button mix={[reloadButtonCss, on('click', () => window.location.reload())]}>
            Reload the page
          </button>
        }
      />
    </div>,
  )
})
```

**Flow**: `app.dispose()` → `fadeOutBody()` animation → `createRoot().render()` ErrorCard with Reload button.

## Pattern: Fade Out Body Animation

```typescript
async function fadeOutBody() {
  let animation = document.body.animate(
    [
      { opacity: 1, transform: 'translateY(0) scale(1)' },
      { opacity: 0, transform: 'translateY(10px) scale(0.985)' },
    ],
    { ...spring('snappy') },
  )
  await animation.finished
  document.body.innerHTML = ''
}
```

Uses the Web Animations API with Remix's spring easing. Waits for animation to finish before clearing the body.

## Pattern: 401 Detection in Frame Resolution

The client-side `resolveFrame` function detects 401 responses and redirects to login:

```typescript
async function resolveFrameResponse(url, signal, target) {
  let response = await fetch(url, { headers, signal })
  if (response.status === 401) {
    window.location.assign(authRoutes.authLogin.index.href())
    return new Promise(() => {}) // halt further processing
  }
  if (!response.ok) {
    return <ErrorCard eyebrow="Unexpected Error" title="Reload required" ... />
  }
  // ...success path
}
```

**Why 401 matters**: When a frame request hits a protected route while the session has expired, the server (with frame-aware auth) returns a 401 fragment. The client detects this and performs a full-page redirect to the login page, since a frame cannot meaningfully show a login form.

## Pattern: ErrorCard Component

```typescript
function ErrorCard(handle: Handle<ErrorCardProps>) {
  return () => {
    let { eyebrow, title, message, action, animated } = handle.props
    return (
      <div mix={animated ? [cardCss, animateGentlyIn] : cardCss}>
        <p mix={eyebrowCss}>{eyebrow}</p>
        <h1 mix={titleCss}>{title}</h1>
        <p mix={messageCss}>{message}</p>
        {action}
      </div>
    )
  }
}
```

**Props**: `eyebrow` (label), `title`, `message`, `action` (RemixNode for button/link), `animated` (boolean — applies entrance animation).

The animation uses `animateEntrance` with spring easing:
```typescript
const animateGentlyIn = animateEntrance({
  opacity: 0,
  transform: 'translateY(-14px) scale(0.97)',
  ...spring('smooth'),
})
```

## Key Points

1. **`.tsx` extension required**: The entry module must use `.tsx` so JSX syntax is available. Rename from `.ts` to `.tsx` and update all references (`app/ui/document.tsx`, `app/assets.ts` allow list).
2. **Server frame errors**: Server-side `resolveFrame` returns `<pre>Frame error: {status} {statusText}</pre>` for non-OK responses (not 401, which goes through redirect checking).
3. **Non-401 client errors**: Client-side `resolveFrame` returns an ErrorCard with a Reload link for non-OK, non-401 responses.

## Codebase References

- `newapp/app/assets/entry.tsx` — Full implementation (ErrorCard, fadeOutBody, global handler, resolveFrame)
- `newapp/app/middleware/render.tsx` — Server-side resolveFrame with error HTML

## Related

- `ui/guides/nav-link.md` — NavLink component pattern
- `guides/frame-navigation-patterns.md` — Frame navigation, redirect following
- `ui/guides/frame-resolution.md` — Frame resolution patterns (server + client)
