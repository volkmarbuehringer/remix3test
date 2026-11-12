import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import type { NodeHmrRunner } from 'remix/node-hmr'

import { createHmrFetch, readyWithTimeout } from './hmr-ready.ts'

function runner(overrides: Partial<NodeHmrRunner>): NodeHmrRunner {
  return {
    generation: 1,
    ready: async () => {},
    close: async () => {},
    ...overrides,
  }
}

describe('HMR ready fetch wrapper', () => {
  it('returns 503 when the runner never becomes ready', async () => {
    let neverReady = runner({ ready: () => new Promise<void>(() => {}) })
    let calls = 0
    let fetch = async () => {
      calls++
      return new Response('app')
    }

    let response = await createHmrFetch(neverReady, fetch, { readyTimeoutMs: 10 })(
      new Request('http://x/'),
    )

    assert.equal(response.status, 503)
    assert.ok((await response.text()).includes('HMR server is starting'))
    assert.equal(calls, 0, 'the app fetch must not run before readiness')
  })

  it('does not replay a non-GET/HEAD request after a generation change', async () => {
    let generation = 1
    let live: NodeHmrRunner = {
      get generation() {
        return generation
      },
      ready: async () => {},
      close: async () => {},
    }
    let calls = 0
    let fetch = async () => {
      calls++
      generation++
      return new Response('unavailable', { status: 503 })
    }

    let response = await createHmrFetch(live, fetch, { readyTimeoutMs: 100 })(
      new Request('http://x/', { method: 'POST', body: 'payload' }),
    )

    assert.equal(response.status, 503)
    assert.equal(calls, 1, 'a POST must not be replayed by the safe-retry default')
  })

  it('replays a GET exactly once when the generation changed in flight', async () => {
    let generation = 1
    let live: NodeHmrRunner = {
      get generation() {
        return generation
      },
      ready: async () => {},
      close: async () => {},
    }
    let calls = 0
    let fetch = async () => {
      calls++
      if (calls === 1) generation++
      return new Response('unavailable', { status: 503 })
    }

    let response = await createHmrFetch(live, fetch, { readyTimeoutMs: 100 })(
      new Request('http://x/'),
    )

    assert.equal(response.status, 503)
    assert.equal(calls, 2, 'a safe GET is replayed once across the generation change')
  })

  it('rejects readyWithTimeout through the wrapper rather than hanging', async () => {
    let neverReady = runner({ ready: () => new Promise<void>(() => {}) })
    let started = Date.now()
    let error: unknown
    try {
      await readyWithTimeout(neverReady, 10)
    } catch (caught) {
      error = caught
    }
    assert.ok(error instanceof Error)
    assert.equal(error.name, 'HmrReadyTimeoutError')
    assert.ok(Date.now() - started >= 5, 'the bound must apply to ready()')
  })
})
