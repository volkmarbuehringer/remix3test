# Guide: Hydration, Frames & Navigation

**Core Idea**: Use `clientEntry()` for interactive islands, `run()` to hydrate, `<Frame>` for independent regions.

## Hydration

```tsx
import { clientEntry, on, run, type Handle } from 'remix/ui'

export let Counter = clientEntry('/assets/entry.js#Counter', (handle: Handle) => {
  let count = 0
  return () => <button mix={[on('click', () => {
    count++
    handle.update()
  })]}>{count}</button>
})

let app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    return mod[exportName]
  },
  async resolveFrame(src, signal) {
    let headers = new Headers({ accept: 'text/html' })
    let response = await fetch(src, { headers, signal })
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }
    return response.body ?? (await response.text())
  },
})

app.addEventListener('error', (event) => console.error(event.error))
await app.ready()
```

## Frames

```tsx
import { renderToStream } from 'remix/ui/server'

let stream = renderToStream(<App />, {
  frameSrc: request.url,
  async resolveFrame(src) {
    let url = new URL(src, request.url)
    let response = await fetch(url)
    if (!response.ok) {
      return `<pre>Frame error: ${response.status} ${response.statusText}</pre>`
    }
    return response.body ?? response.text()
  },
})
```

**Key points**:
- `frameSrc` seeds SSR frame state
- `resolveFrame(src)` — single parameter, no `target` or `frameContext`
- Frame errors return `<pre>Frame error: ${status} ${statusText}</pre>`
- Frame content can be HTML strings, streams, or Remix nodes

## Navigation

- **Anchors**: prefer for normal document navigation
- **App-driven**: `navigate(href, options)` or `link(href, options)` mixin for page-level navigation
- **Frame-targeted**: `<a rmx-target="frame-name">` for user-initiated Frame navigation
- Attributes: `rmx-target`, `rmx-src`, `rmx-document`

> **⚠️ Limitation**: `navigate(href, { target })` and programmatic `<a rmx-target>` clicks do NOT work reliably for Frame updates from JS event handlers. Chrome's Navigation API does not set `event.sourceElement` for programmatic clicks, and `event.destination.getState()` may not return `$rmx` state for `replace` navigations. Use `fetch()` + DOM replacement for programmatic Frame updates. See `errors/frame-programmatic-navigation.md`.

## Head Management

```tsx
function App() {
  return () => (
    <html>
      <head>
        <title>Dashboard</title>
        <meta name="description" content="Team dashboard" />
      </head>
      <body><main>...</main></body>
    </html>
  )
}
```

- Put document-level `title`, `meta`, `link`, `style` in explicit `<head>`
- JSON-LD rendered in place unless in `<head>`

**Reference**: [hydration-frames concept](../concepts/hydration-frames.md)