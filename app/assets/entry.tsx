import { run } from 'remix/ui'
import { spring } from 'remix/ui/animation'

import { resolveFrameResponse } from './frame-response.browser.tsx'

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl)
    let exp = (mod as Record<string, unknown>)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }
    return exp
  },
  async resolveFrame(src, options) {
    return resolveFrameResponse(new URL(src, window.location.href), options)
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
