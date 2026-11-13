import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { agentPrefillMap } from '../ui/agent-prefill-store.browser.ts'
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
//
// Since the #12277 migration `prefetchFrame` delegates to `defaultPrefetch` and only
// overrides the request (prefill/no-store) and the post-parse asset discovery. These
// tests drive the real vendor strategy with a stubbed `fetch`.
// ---------------------------------------------------------------------------

let originalFetch: typeof window.fetch | undefined
let fetchCalls = 0
let lastFetchInit: RequestInit | undefined
let caseId = 0

/** A unique warmed source per test: the vendor's in-flight dedupe is process-wide. */
function source(label: string): string {
  caseId += 1
  return `/admin/lists?case=${label}-${caseId}`
}

function stubFetch(response: Partial<Response>) {
  stubFetchFactory(() => response as Response)
}

function stubFetchFactory(create: () => Response) {
  originalFetch ??= window.fetch
  fetchCalls = 0
  lastFetchInit = undefined
  window.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls += 1
    lastFetchInit = init
    return create()
  }) as typeof window.fetch
}

/** Flush the fetch -> store promise chain (task turns, not a time window). */
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
  lastFetchInit = undefined
  agentPrefillMap.clear()
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

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

describe('frame prefetch cache', () => {
  it('warms the GET a navigation would fetch and serves it once', async () => {
    let response = okResponse()
    stubFetch(response)
    let src = source('once')

    prefetchFrame(src, { target: 'admin-content' })
    await settlePrefetches()

    assert.equal(fetchCalls, 1)
    let url = new URL(src, window.location.href)
    assert.equal(takePrefetchedFrame(url, 'admin-content'), response)
    assert.equal(
      takePrefetchedFrame(url, 'admin-content'),
      undefined,
      'a warmed frame must only be used once',
    )
  })

  it('dedupes concurrent prefetches for the same source and target', async () => {
    stubFetch(okResponse())
    let src = source('dedupe')

    prefetchFrame(src, { target: 'admin-content' })
    prefetchFrame(src, { target: 'admin-content' })
    await settlePrefetches()

    assert.equal(fetchCalls, 1)
  })

  it('keys warmed frames by frame target', async () => {
    stubFetch(okResponse())
    let src = source('target')

    prefetchFrame(src, { target: 'admin-content' })
    await settlePrefetches()

    let url = new URL(src, window.location.href)
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
    let first = source('sibling-a')
    let second = source('sibling-b')

    prefetchFrame(first, { target: 'admin-content' })
    prefetchFrame(second, { target: 'admin-content' })
    await settlePrefetches()

    assert.ok(takePrefetchedFrame(new URL(first, window.location.href), 'admin-content'))
    assert.equal(
      takePrefetchedFrame(new URL(second, window.location.href), 'admin-content'),
      undefined,
      'an uncached navigation invalidates the other warmed pages',
    )
  })

  it('awaits an in-flight warm instead of fetching the fragment twice', async () => {
    let deferred = stubDeferredFetch()
    let src = source('in-flight')
    let url = new URL(src, window.location.href)

    prefetchFrame(src, { target: 'admin-content' })
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

    let src = source('caller-abort')
    let url = new URL(src, window.location.href)
    let caller = new AbortController()

    prefetchFrame(src, { target: 'admin-content', signal: caller.signal })
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

    prefetchFrame(source('pre-aborted'), {
      target: 'admin-content',
      signal: caller.signal,
    })
    await settlePrefetches()

    assert.equal(fetchCalls, 0)
  })

  it('does not store a response for a caller that aborts before it arrives', async () => {
    // Regression:@12277 wires the caller signal into the shared strategy; aborting it
    // must not let an in-flight response populate the one-shot cache.
    let deferred = stubDeferredFetch()
    let src = source('mid-abort')
    let url = new URL(src, window.location.href)
    let caller = new AbortController()

    prefetchFrame(src, { target: 'admin-content', signal: caller.signal })
    await settlePrefetches()
    caller.abort(new DOMException('anchor removed', 'AbortError'))
    deferred.resolve(okResponse())
    await settlePrefetches()

    assert.equal(takePrefetchedFrame(url, 'admin-content'), undefined)
  })

  it('rejects a claim when the navigation aborts while waiting for the warm', async () => {
    let deferred = stubDeferredFetch()
    let src = source('claim-abort')
    let url = new URL(src, window.location.href)
    let controller = new AbortController()

    prefetchFrame(src, { target: 'admin-content' })
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
    let src = source('refused')

    prefetchFrame(src, { target: 'admin-content' })
    await settlePrefetches()

    assert.equal(
      takePrefetchedFrame(new URL(src, window.location.href), 'admin-content'),
      undefined,
      'a redirect with a target is a document navigation, never a warmer',
    )
  })
})

// ---------------------------------------------------------------------------
// Request policy and classification through `defaultPrefetch`
//
// The vendor prepares the prefetch GET (`X-Remix-Frame`/`X-Remix-Target`/
// `X-Remix-Prefetch`, low priority). The app adds the one-shot prefill, no-store,
// and only caches a response a real navigation would render.
// ---------------------------------------------------------------------------

describe('frame prefetch request policy', () => {
  it('sends the vendor prefetch headers, low priority, no-store, and the prefill', async () => {
    let src = source('headers')
    let url = new URL(src, window.location.href)
    agentPrefillMap.set(url.pathname + url.search, { message: 'hi' })
    stubFetch(okResponse())

    prefetchFrame(src, { target: 'admin-content' })
    await settlePrefetches()

    assert.equal(lastFetchInit?.cache, 'no-store')
    assert.equal((lastFetchInit as { priority?: unknown } | undefined)?.priority, 'low')
    let headers = new Headers(lastFetchInit?.headers)
    assert.equal(headers.get('Accept'), 'text/html')
    assert.equal(headers.get('X-Remix-Frame'), 'true')
    assert.equal(headers.get('X-Remix-Target'), 'admin-content')
    assert.equal(headers.get('X-Remix-Prefetch'), 'true')
    let raw = headers.get('X-Agent-Prefill')
    assert.ok(raw, 'expected the one-shot prefill header')
    assert.deepEqual(JSON.parse(atob(raw)), { message: 'hi' })
    assert.ok(
      agentPrefillMap.has(url.pathname + url.search),
      'a prefetch must not consume the prefill a real navigation would use',
    )
  })

  it('caches an HTML 4xx validation fragment and keeps the body readable', async () => {
    let src = source('validation')
    stubFetchFactory(() => htmlResponse('<div>slot outside hours</div>', 400))

    prefetchFrame(src, { target: 'admin-content' })
    await settlePrefetches()

    let cached = takePrefetchedFrame(new URL(src, window.location.href), 'admin-content')
    assert.ok(cached, 'a 4xx HTML fragment is what a real navigation renders')
    assert.equal(await cached.text(), '<div>slot outside hours</div>')
  })

  it('caches a clone and leaves the original for the vendor parser', async () => {
    let src = source('clone')
    let response = htmlResponse('<div>Lists</div>')
    stubFetch(response)

    prefetchFrame(src, { target: 'admin-content' })
    await settlePrefetches()

    let cached = takePrefetchedFrame(new URL(src, window.location.href), 'admin-content')
    assert.ok(cached)
    assert.ok(cached !== response, 'the vendor parser consumes the original response')
    assert.equal(await cached.text(), '<div>Lists</div>')
  })

  for (let [label, response] of [
    ['5xx', () => htmlResponse('<div>boom</div>', 500)],
    [
      'non-HTML 2xx',
      () => new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } }),
    ],
    [
      'non-HTML 4xx',
      () =>
        new Response('{"error":"nope"}', {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
    ],
    [
      '401',
      () => new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } }),
    ],
  ] as const) {
    it(`does not cache a ${label} response`, async () => {
      let src = source('refuse-' + label)
      stubFetchFactory(response)

      prefetchFrame(src, { target: 'admin-content' })
      await settlePrefetches()

      assert.equal(
        takePrefetchedFrame(new URL(src, window.location.href), 'admin-content'),
        undefined,
      )
    })
  }
})
