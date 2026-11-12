import { createHmrReadyFetch, type NodeHmrRunner } from 'remix/node-hmr'

/**
 * Bounds `createHmrReadyFetch()`'s unbounded `runner.ready()` wait so a restart
 * that never becomes ready still yields an HTTP response instead of hanging the
 * proxy request. Non-GET/HEAD requests keep the vendor retry contract: they are
 * not replayed after a generation change.
 */

export class HmrReadyTimeoutError extends Error {
  constructor() {
    super('HMR server did not become ready in time')
    this.name = 'HmrReadyTimeoutError'
  }
}

export interface HmrFetchOptions {
  readyTimeoutMs: number
}

export function readyWithTimeout(runner: NodeHmrRunner, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let timer = setTimeout(() => reject(new HmrReadyTimeoutError()), timeoutMs)
    runner.ready().then(
      () => {
        clearTimeout(timer)
        resolve()
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/** Wraps a runner so `ready()` rejects after `timeoutMs` instead of waiting forever. */
export function withReadyTimeout(runner: NodeHmrRunner, timeoutMs: number): NodeHmrRunner {
  return {
    get generation() {
      return runner.generation
    },
    ready: () => readyWithTimeout(runner, timeoutMs),
    close: () => runner.close(),
  }
}

export function createHmrFetch(
  runner: NodeHmrRunner,
  fetch: (request: Request) => Response | Promise<Response>,
  options: HmrFetchOptions,
): (request: Request) => Promise<Response> {
  let fetchWhenReady = createHmrReadyFetch(withReadyTimeout(runner, options.readyTimeoutMs), fetch)

  return async (request) => {
    try {
      return await fetchWhenReady(request)
    } catch (error) {
      if (!(error instanceof HmrReadyTimeoutError)) throw error
      return new Response(
        'HMR server is starting or failed to start. Check the `npm run hmr` terminal output for errors.',
        { status: 503 },
      )
    }
  }
}
