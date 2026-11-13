import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import {
  claimPrefetchedFrame,
  clearPrefetchedFrames,
  prefetchFrame,
  takePrefetchedFrame,
} from './frame-prefetch.browser.ts'

// ---------------------------------------------------------------------------
// One-shot prefetch cache
//
// The runtime's prefetch hook calls `prefetchFrame` on hover/focus intent; the entry
// resolver claims the warmed response with `takePrefetchedFrame` so the follow-up
// navigation does not fetch the fragment a second time. Entries are keyed by frame
// target, single use, and dropped together once one is consumed.
// ---------------------------------------------------------------------------

let originalFetch: typeof window.fetch | undefined
let fetchCalls = 0

function stubFetch(response: Partial<Response>) {
  originalFetch ??= window.fetch
  fetchCalls = 0
  window.fetch = (async () => {
    fetchCalls += 1
    return response as Response
  }) as typeof window.fetch
}

/** Flush the fetch -> store -> asset-discovery promise chain (task turns, not a time window). */
async function settlePrefetches(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function stubDeferredFetch() {
  originalFetch ??= window.fetch
  fetchCalls = 0
  let resolveResponse!: (response: Response) => void
  let pending = new Promise<Response>((resolve) => {
    resolveResponse = resolve
  })
  window.fetch = (async () => {
    fetchCalls += 1
    return pending
  }) as typeof window.fetch
  return { resolve: (response: Response) => resolveResponse(response) }
}

afterEach(() => {
  clearPrefetchedFrames()
  if (originalFetch) {
    window.fetch = originalFetch
    originalFetch = undefined
  }
  fetchCalls = 0
})

function okResponse(): Response {
  return {
    ok: true,
    redirected: false,
    status: 200,
    statusText: '',
    url: 'https://remix.run/admin/lists',
    headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
    text: async () => '<div>Lists</div>',
  } as Response
}

describe('frame prefetch cache', () => {
  it('warms the GET a navigation would fetch and serves it once', async () => {
    let response = okResponse()
    stubFetch(response)

    prefetchFrame('/admin/lists?page=2', { target: 'admin-content' })
    await settlePrefetches()

    assert.equal(fetchCalls, 1)
    let url = new URL('/admin/lists?page=2', window.location.origin)
    assert.equal(takePrefetchedFrame(url, 'admin-content'), response)
    assert.equal(
      takePrefetchedFrame(url, 'admin-content'),
      undefined,
      'a warmed frame must only be used once',
    )
  })

  it('dedupes concurrent prefetches for the same source and target', async () => {
    stubFetch(okResponse())

    prefetchFrame('/admin/lists', { target: 'admin-content' })
    prefetchFrame('/admin/lists', { target: 'admin-content' })
    await settlePrefetches()

    assert.equal(fetchCalls, 1)
  })

  it('keys warmed frames by frame target', async () => {
    stubFetch(okResponse())

    prefetchFrame('/admin/lists', { target: 'admin-content' })
    await settlePrefetches()

    let url = new URL('/admin/lists', window.location.origin)
    assert.equal(takePrefetchedFrame(url, 'other-frame'), undefined)
    assert.ok(takePrefetchedFrame(url, 'admin-content'))
  })

  it('ignores cross-origin sources', async () => {
    stubFetch(okResponse())

    prefetchFrame('https://evil.example/admin/lists', { target: 'admin-content' })
    await settlePrefetches()

    assert.equal(fetchCalls, 0)
  })

  it('drops every warmed frame once one is consumed', async () => {
    stubFetch(okResponse())

    prefetchFrame('/admin/lists/a', { target: 'admin-content' })
    prefetchFrame('/admin/lists/b', { target: 'admin-content' })
    await settlePrefetches()

    assert.ok(
      takePrefetchedFrame(new URL('/admin/lists/a', window.location.origin), 'admin-content'),
    )
    assert.equal(
      takePrefetchedFrame(new URL('/admin/lists/b', window.location.origin), 'admin-content'),
      undefined,
      'an uncached navigation invalidates the other warmed pages',
    )
  })

  it('awaits an in-flight warm instead of fetching the fragment twice', async () => {
    let deferred = stubDeferredFetch()
    let url = new URL('/admin/lists?status=empty', window.location.origin)

    prefetchFrame(url.href, { target: 'admin-content' })
    let claim = claimPrefetchedFrame(url, 'admin-content')
    let response = okResponse()
    deferred.resolve(response)

    assert.equal(await claim, response)
    assert.equal(fetchCalls, 1, 'the navigation must reuse the in-flight warm')
    assert.equal(
      takePrefetchedFrame(url, 'admin-content'),
      undefined,
      'a claimed warm is single use',
    )
  })

  it('keeps a warmed response readable after its prefetch caller aborts', async () => {
    originalFetch ??= window.fetch
    fetchCalls = 0
    let closeBody!: () => void
    let encoder = new TextEncoder()
    window.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      fetchCalls += 1
      let body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('<p>warmed</p>'))
          closeBody = () => {
            try {
              controller.close()
            } catch {
              // An aborted fetch already errored this stream.
            }
          }
          init?.signal?.addEventListener('abort', () => controller.error(init.signal?.reason), {
            once: true,
          })
        },
      })
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      })
    }) as typeof window.fetch

    let url = new URL('/admin/lists?week=47', window.location.origin)
    let caller = new AbortController()

    prefetchFrame(url.href, { target: 'admin-content', signal: caller.signal })
    await settlePrefetches()
    let claimed = takePrefetchedFrame(url, 'admin-content')
    assert.ok(claimed, 'the warm must be stored before the caller aborts')

    // A frame navigation claims the warm and then unmounts the anchor that started
    // it, so the runtime cancels this caller while the frame is still reading the body.
    caller.abort(new DOMException('anchor removed', 'AbortError'))
    closeBody()

    assert.equal(await claimed.text(), '<p>warmed</p>')
  })

  it('does not warm a source for a caller that already aborted', async () => {
    stubFetch(okResponse())
    let caller = new AbortController()
    caller.abort(new DOMException('anchor removed', 'AbortError'))

    prefetchFrame('/admin/lists', { target: 'admin-content', signal: caller.signal })
    await settlePrefetches()

    assert.equal(fetchCalls, 0)
  })

  it('rejects a claim when the navigation aborts while waiting for the warm', async () => {
    let deferred = stubDeferredFetch()
    let url = new URL('/admin/lists?status=empty', window.location.origin)
    let controller = new AbortController()

    prefetchFrame(url.href, { target: 'admin-content' })
    let claim = claimPrefetchedFrame(url, 'admin-content', controller.signal)
    controller.abort(new Error('navigation cancelled'))

    let rejected: unknown
    try {
      await claim
    } catch (error) {
      rejected = error
    }
    assert.ok(rejected instanceof Error, 'an aborted claim must reject like an aborted fetch')
    assert.equal(rejected.message, 'navigation cancelled')

    deferred.resolve(okResponse())
  })

  it('does not cache a response the resolver refused', async () => {
    stubFetch({
      ok: true,
      redirected: true,
      status: 200,
      statusText: '',
      url: 'https://remix.run/login',
      headers: new Headers({ 'Content-Type': 'text/html; charset=utf-8' }),
    })

    prefetchFrame('/admin/client', { target: 'admin-content' })
    await settlePrefetches()

    assert.equal(
      takePrefetchedFrame(new URL('/admin/client', window.location.origin), 'admin-content'),
      undefined,
      'a redirect with a target is a document navigation, never a warmer',
    )
  })
})
