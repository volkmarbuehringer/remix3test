import { run } from 'remix/component'
import type { FrameContent, ResolveFrameOptions } from 'remix/component'
import {
  detectMultipleImportMapSupport,
  importModule,
  preloadShim,
} from 'remix/multiple-import-maps-polyfill'

import { agentPrefillMap } from '../ui/agent-prefill-store.browser.ts'
import { fadeOutBody } from './fade-out-body.ts'
import {
  claimPrefetchedFrame,
  clearPrefetchedFrames,
  prefetchFrame,
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

    // `data-rmx-prefetch` / `prefetch()` warmed this exact GET through the app's
    // `defaultPrefetch` overrides; claim it instead of paying for a second SSR. A warm
    // still in flight (the runtime starts it on pointerdown) is awaited, not duplicated.
    if (isPlainGet(options)) {
      let cached = await claimPrefetchedFrame(url, options?.target, options?.signal)
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

let fatalErrorHandled = false

/**
 * Report one root failure and replace the broken app with the app-owned fatal
 * card. Both `run()` failures and unhandled promise rejections share this path
 * so a rejection cannot leave a half-live runtime behind.
 */
async function handleFatalError(error: unknown) {
  if (fatalErrorHandled) return
  fatalErrorHandled = true

  // Report the original error before the runtime is torn down; the fatal card only
  // shows the message, so without this the stack is lost (guide 06 §"Handle failures
  // and cancellation" / ch. 12 §"Handle browser runtime errors at the app root").
  console.error(error)
  app.dispose()
  let errorCard = import('./error-card.browser.tsx')
  await fadeOutBody()

  let message = error instanceof Error ? error.message : String(error)
  try {
    let { renderFatalError } = await errorCard
    renderFatalError(message)
  } catch {
    document.body.textContent = `Fatal error: ${message}`
  }
}

app.addEventListener('error', (event) => {
  void handleFatalError(event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  // Treat the rejection as handled only because this root listener now reports
  // it and renders the fatal card; otherwise browsers also emit a duplicate
  // uncaught-rejection page error.
  event.preventDefault()
  void handleFatalError(event.reason)
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
