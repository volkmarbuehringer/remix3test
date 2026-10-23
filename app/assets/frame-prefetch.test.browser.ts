import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import {
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

async function settlePrefetches(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20))
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
    url: 'https://remix.run/admin/lists',
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

  it('does not cache a response the resolver refused', async () => {
    stubFetch({ ok: true, redirected: true, status: 200, url: 'https://remix.run/login' })

    prefetchFrame('/admin/client', { target: 'admin-content' })
    await settlePrefetches()

    assert.equal(
      takePrefetchedFrame(new URL('/admin/client', window.location.origin), 'admin-content'),
      undefined,
      'a redirect with a target is a document navigation, never a warmer',
    )
  })
})
