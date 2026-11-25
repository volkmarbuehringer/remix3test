import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import type { RequestContext } from 'remix/router'

import { requestTimeout } from './request-timeout.ts'

// ---------------------------------------------------------------------------
// requestTimeout — opt-in request deadline
//
// The middleware must (a) pass the combined request/deadline signal downstream,
// (b) answer 504 when the deadline wins, cancelling a late response body, and
// (c) stay inert when unset or when the request is an SSE stream.
// ---------------------------------------------------------------------------

const REQUEST_URL = 'https://remix.run/slow'
const TIMEOUT_MS = 20

function createContext(headers: Record<string, string> = {}, signal?: AbortSignal): RequestContext {
  let request = new Request(REQUEST_URL, { headers, ...(signal ? { signal } : {}) })
  return { request, url: new URL(REQUEST_URL) } as unknown as RequestContext
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('requestTimeout middleware', () => {
  it('answers 504 when the deadline wins and cancels the late response body', async () => {
    let context = createContext()
    let downstreamSignal: AbortSignal | undefined
    let lateBodyCancelled = false

    let response = await requestTimeout({ timeoutMs: TIMEOUT_MS })(context, () => {
      downstreamSignal = context.request.signal
      return new Promise<Response>((resolve) => {
        downstreamSignal?.addEventListener(
          'abort',
          () => {
            resolve(
              new Response(
                new ReadableStream({
                  cancel() {
                    lateBodyCancelled = true
                  },
                }),
              ),
            )
          },
          { once: true },
        )
      })
    })

    assert.equal(response.status, 504)
    assert.equal(response.statusText, 'Gateway Timeout')
    assert.equal(response.headers.get('Cache-Control'), 'no-store')
    assert.equal(await response.text(), 'Request timed out.')
    assert.ok(downstreamSignal?.aborted, 'downstream should see the combined signal abort')

    await delay(0)
    assert.ok(lateBodyCancelled, 'the abandoned response body should be cancelled')
  })

  it('still rejects when downstream fails before the deadline', async () => {
    let context = createContext()
    await assert.rejects(async () => {
      await requestTimeout({ timeoutMs: TIMEOUT_MS })(context, async () => {
        throw new Error('boom')
      })
    }, /boom/)
  })

  it('is inert when no timeout is configured', async () => {
    let previous = process.env.REQUEST_TIMEOUT_MS
    delete process.env.REQUEST_TIMEOUT_MS
    try {
      let context = createContext()
      let original = context.request
      let response = await requestTimeout()(context, async () => new Response('ok'))
      assert.equal(response.status, 200)
      assert.equal(context.request, original, 'the request should not be replaced')
      assert.equal(await response.text(), 'ok')
    } finally {
      if (previous === undefined) delete process.env.REQUEST_TIMEOUT_MS
      else process.env.REQUEST_TIMEOUT_MS = previous
    }
  })

  it('reads REQUEST_TIMEOUT_MS at call time', async () => {
    let previous = process.env.REQUEST_TIMEOUT_MS
    process.env.REQUEST_TIMEOUT_MS = String(TIMEOUT_MS)
    try {
      let context = createContext()
      let response = await requestTimeout()(context, () => new Promise<Response>(() => {}))
      assert.equal(response.status, 504)
    } finally {
      if (previous === undefined) delete process.env.REQUEST_TIMEOUT_MS
      else process.env.REQUEST_TIMEOUT_MS = previous
    }
  })

  it('forwards a caller abort to the downstream signal', async () => {
    let caller = new AbortController()
    let context = createContext({}, caller.signal)
    let downstreamSignal: AbortSignal | undefined

    let pending = requestTimeout({ timeoutMs: 60_000 })(context, async () => {
      downstreamSignal = context.request.signal
      await new Promise<void>((resolve) => {
        downstreamSignal?.addEventListener('abort', () => resolve(), { once: true })
      })
      return new Response('downstream done')
    })

    caller.abort(new Error('client disconnected'))
    let response = await pending

    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'downstream done')
    assert.ok(downstreamSignal?.aborted, 'the caller abort should reach the downstream signal')
  })

  it('preserves the method and body for downstream work', async () => {
    let request = new Request(REQUEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ a: '1' }),
    })
    let context = { request, url: new URL(REQUEST_URL) } as unknown as RequestContext
    let seenMethod: string | undefined
    let seenBody: string | undefined

    let response = await requestTimeout({ timeoutMs: 60_000 })(context, async () => {
      seenMethod = context.request.method
      seenBody = await context.request.text()
      return new Response('ok')
    })

    assert.equal(response.status, 200)
    assert.equal(seenMethod, 'POST')
    assert.equal(seenBody, 'a=1')
  })

  it('skips SSE requests by Accept header', async () => {
    let context = createContext({ Accept: 'text/event-stream' })
    let pending = requestTimeout({ timeoutMs: TIMEOUT_MS })(context, async () => {
      await delay(TIMEOUT_MS * 2)
      return new Response('stream', { headers: { 'Content-Type': 'text/event-stream' } })
    })
    let response = await pending
    assert.equal(response.status, 200)
    assert.equal(context.request.signal.aborted, false)
  })

  it('skips fetch()-based SSE requests marked with X-Sse-Request', async () => {
    let context = createContext({ 'X-Sse-Request': '1' })
    let response = await requestTimeout({ timeoutMs: TIMEOUT_MS })(context, async () => {
      await delay(TIMEOUT_MS * 2)
      return new Response('stream', { headers: { 'Content-Type': 'text/event-stream' } })
    })
    assert.equal(response.status, 200)
    assert.equal(context.request.signal.aborted, false)
  })
})
