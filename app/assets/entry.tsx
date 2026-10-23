import { run } from 'remix/component'
import type { FrameContent, ResolveFrameOptions } from 'remix/component'
import { spring } from '@remix-run/ui/animation'
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'

import { agentPrefillMap } from '../ui/agent-prefill-store.browser.ts'
import {
  clearPrefetchedFrames,
  prefetchFrame,
  takePrefetchedFrame,
} from './frame-prefetch.browser.ts'
import { resolveFrameResponse } from './frame-response.browser.tsx'

let app: ReturnType<typeof run>
app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await importModule(moduleUrl)
    let exp = (mod as Record<string, unknown>)[exportName]
    if (typeof exp !== 'function') {
      throw new Error(`Export "${exportName}" from "${moduleUrl}" is not a function`)
    }
    return exp
  },
  async processClientEntryPreloads(preloads) {
    if (await detectMultipleImportMapSupport()) return preloads
    void preloadShim(preloads)
    return []
  },
  prefetch(src, options) {
    prefetchFrame(src, options)
  },
  async resolveFrame(src, options) {
    let url = new URL(src, window.location.href)

    // `data-rmx-prefetch` / `prefetch()` warmed this exact GET through the app
    // resolver; claim it instead of paying for a second SSR.
    if (isPlainGet(options)) {
      let cached = takePrefetchedFrame(url, options?.target)
      if (cached) {
        // The warmed response already rendered (and so already consumed) any agent prefill.
        agentPrefillMap.delete(url.pathname + url.search)
        reconcileFrameRedirect(cached, options?.target)
        return cached
      }
      // An uncached navigation may change the data other warmed pages were built on.
      clearPrefetchedFrames()
    }

    let result = await resolveFrameResponse(url, options)
    reconcileFrameRedirect(result, options?.target)
    return result
  },
})

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

function isPlainGet(options?: ResolveFrameOptions): boolean {
  return (options?.method ?? 'get').toLowerCase() === 'get' && options?.formData === undefined
}

function reconcileFrameRedirect(result: FrameContent | Response, target?: string): void {
  // An in-frame followed redirect (frameRedirects) returns a 200 fragment but
  // is not marked `redirected`, so the frame runtime cannot infer the
  // destination. Left unchecked, the frame's `src` stays at the POST action
  // URL (e.g. /admin/users/2/toggle-disabled) and a later reload GETs it →
  // 404. Read the header the middleware set and reconcile the frame's src.
  if (!(result instanceof Response)) return
  let dest = result.headers.get('X-Remix-Redirect-To')
  if (!dest || !target) return
  let frame = app.frames.get(target)
  if (frame) frame.src = dest
}

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
