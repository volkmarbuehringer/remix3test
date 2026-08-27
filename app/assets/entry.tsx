import { run } from 'remix/ui'
import { spring } from 'remix/ui/animation'

import { resolveFrameResponse } from './frame-response.browser.tsx'

let app: ReturnType<typeof run>
app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    let exp = (mod as Record<string, unknown>)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }
    return exp
  },
  async resolveFrame(src, options) {
    let result = await resolveFrameResponse(new URL(src, window.location.href), options)
    // An in-frame followed redirect (frameRedirects) returns a 200 fragment but
    // is not marked `redirected`, so the frame runtime cannot infer the
    // destination. Left unchecked, the frame's `src` stays at the POST action
    // URL (e.g. /admin/users/2/toggle-disabled) and a later reload GETs it →
    // 404. Read the header the middleware set and reconcile the frame's src.
    if (result instanceof Response) {
      let dest = result.headers.get('X-Remix-Redirect-To')
      if (dest && options?.target) {
        let frame = app.frames.get(options.target)
        if (frame) frame.src = dest
      }
    }
    return result
  },
})

if (import.meta.hot) {
  import.meta.hot.on('server:update', async () => {
    try {
      await app.ready()
      await app.frames.top.reload()
    } catch (error) {
      console.error('Error reloading top frame on server update', error)
      window.location.reload()
    }
  })
}

app.addEventListener('error', async (event) => {
  app.dispose()
  let errorCard = import('./error-card.browser.tsx')
  await fadeOutBody()

  let message = 'message' in event.error ? event.error.message : 'Unknown error'
  try {
    let { renderFatalError } = await errorCard
    renderFatalError(message)
  } catch {
    document.body.textContent = `Fatal error: ${message}`
  }
})

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
