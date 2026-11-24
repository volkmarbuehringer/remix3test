import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { delayAbortably, runFrameProbe } from './frame-probe.ts'

function frameRequest(signal?: AbortSignal): Request {
  return new Request('http://test.local/frame', {
    headers: { 'X-Remix-Frame': 'true' },
    ...(signal ? { signal } : {}),
  })
}

describe('frame probe', () => {
  it('passes non-frame requests straight through', async () => {
    let called = 0
    let response = await runFrameProbe(
      new Request('http://test.local/document'),
      async () => {
        called++
        return new Response('document')
      },
      { delayMs: 10_000, shouldFail: () => true },
    )

    assert.equal(await response.text(), 'document')
    assert.equal(called, 1)
  })

  it('delays then fails a selected frame request without reaching the router', async () => {
    let called = 0
    let response = await runFrameProbe(
      frameRequest(),
      async () => {
        called++
        return new Response('ok')
      },
      {
        delayMs: 5,
        shouldFail: (request) => request.method === 'GET',
      },
    )

    assert.equal(response.status, 503)
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(called, 0)
  })

  it('routes an unselected frame request after the delay', async () => {
    let response = await runFrameProbe(frameRequest(), async () => new Response('fragment'), {
      delayMs: 5,
      shouldFail: () => false,
    })

    assert.equal(await response.text(), 'fragment')
  })

  it('rejects an in-flight delay when the request aborts', async () => {
    let controller = new AbortController()
    let pending = delayAbortably(10_000, controller.signal)
    controller.abort(new Error('navigation cancelled'))

    let rejected: unknown
    try {
      await pending
    } catch (error) {
      rejected = error
    }

    assert.ok(rejected instanceof Error)
    assert.equal(rejected.message, 'navigation cancelled')
  })
})
