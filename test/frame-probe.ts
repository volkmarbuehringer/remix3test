/**
 * Test-only frame-request probe.
 *
 * E2E servers normally answer instantly, which hides loading, abort, race, and
 * recovery behavior. Wrap `router.fetch` with this helper to add abortable
 * latency and deterministic failure responses to frame requests only.
 */
export interface FrameProbeOptions {
  /** Delay frame requests by this many milliseconds, or derive it per request. */
  delayMs?: number | ((request: Request) => number)
  /** Return true to answer with the simulated failure response instead of routing. */
  shouldFail?: (request: Request) => boolean
  /** Override the default simulated 503 response. */
  failure?: Response | (() => Response)
}

export async function runFrameProbe(
  request: Request,
  next: () => Promise<Response>,
  options: FrameProbeOptions = {},
): Promise<Response> {
  if (request.headers.get('X-Remix-Frame') !== 'true') return next()

  let delay = typeof options.delayMs === 'function' ? options.delayMs(request) : options.delayMs
  if (delay !== undefined && delay > 0) {
    await delayAbortably(delay, request.signal)
  }

  if (options.shouldFail?.(request)) {
    if (typeof options.failure === 'function') return options.failure()
    return (
      options.failure ??
      new Response('Simulated frame request failure.', {
        status: 503,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
        },
      })
    )
  }

  return next()
}

/** Resolve after `ms`, or reject as soon as the request is aborted. */
export function delayAbortably(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()

  return new Promise<void>((resolve, reject) => {
    let timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    function onAbort() {
      clearTimeout(timer)
      reject(signal.reason)
    }

    signal.addEventListener('abort', onAbort, { once: true })
  })
}
