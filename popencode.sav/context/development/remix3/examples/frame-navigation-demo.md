<!-- Context: development/remix3/examples/frame-navigation-demo | Priority: high | Version: 2.0 | Updated: 2026-05-05 -->

# Example: Frame Navigation Multi-Panel Layout

**Core Idea**: Sidebar nav + `<Frame>` content panel with URL-targeted resolution, redirect following, and global error handler from `~/remix/demos/frame-navigation/`.

## Router + Frame Targeting

```typescript
// Controller uses <Frame> for a nested settings panel
import { Frame } from 'remix/ui'
import { getContext } from 'remix/async-context-middleware'

function SettingsShellOrFragment() {
  return () => {
    if (isFrameRequest()) {
      return <SettingsLayout activeItem={activeItem}>{children}</SettingsLayout>
    }
    return (
      <Layout title="Settings" activeNav="settings">
        <Frame name={frames.settings} src={getContext().request.url} />
      </Layout>
    )
  }
}
function isFrameRequest() {
  return getContext().request.headers.get('x-remix-target') === frames.settings
}
```

## resolveFrame with Redirect Following

```typescript
async function resolveFrame(router, request, src, target, context) {
  let url = new URL(src, context?.currentFrameSrc ?? request.url)
  let headers = new Headers({ accept: 'text/html', 'accept-encoding': 'identity', 'x-remix-frame': 'true' })
  if (target) headers.set('x-remix-target', target)
  let cookie = request.headers.get('cookie')
  if (cookie) headers.set('cookie', cookie)

  let res = await followRedirects(router, request, url, headers)
  return res.ok ? res.text() : `<pre>Frame error: ${res.status} ${res.statusText}</pre>`
}

async function followRedirects(router, request, url, headers, maxRedirects = 10) {
  while (maxRedirects-- > 0) {
    let res = await router.fetch(new Request(url, { headers, signal: request.signal }))
    let location = res.headers.get('location')
    if (!location || res.status < 300 || res.status >= 400) return res
    url = new URL(location, url)
  }
  throw new Error('Too many frame redirects')
}
```

## Global Error Handler with Animation

```typescript
import { run, createRoot, css, on } from 'remix/ui'
import { animateEntrance, spring } from 'remix/ui/animation'

app.addEventListener('error', async (event) => {
  app.dispose()
  await document.body.animate(
    [{ opacity: 1 }, { opacity: 0, transform: 'translateY(10px)' }],
    { ...spring('snappy') },
  ).finished
  document.body.innerHTML = ''
  createRoot(document.body).render(<ErrorCard title="Something went wrong" message={event.error.message} />)
})
```

## 401 Frame Redirect
```typescript
if (res.status === 401) { window.location.assign(routes.auth.login.href()); return new Promise(() => {}) }
```

## Reference
- Demo: `~/remix/demos/frame-navigation/`
- Frames: `ui/concepts/hydration-frames.md`
