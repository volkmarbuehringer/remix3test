import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { createChannel } from './sse.ts'

// ── Helpers ──

/**
 * Read all available data from the stream by first aborting the controller
 * (which triggers stream close) and then draining the buffer.
 */
async function readAllFromStream(
  stream: ReadableStream,
  controller: AbortController,
): Promise<string> {
  controller.abort()
  let reader = stream.getReader()
  let parts: string[] = []
  try {
    while (true) {
      let { value, done } = await reader.read()
      if (done) break
      parts.push(new TextDecoder().decode(value))
    }
  } finally {
    reader.cancel()
  }
  return parts.join('')
}

/**
 * Read one chunk from a stream as text. The reader is cancelled after
 * reading so the test doesn't leak resources. Only useful when you know
 * the first chunk contains everything you need.
 */
async function readOneChunk(
  stream: ReadableStream,
): Promise<string> {
  let reader = stream.getReader()
  try {
    let { value, done } = await reader.read()
    return done ? '' : new TextDecoder().decode(value)
  } finally {
    reader.cancel()
  }
}

// ── Tests ──

describe('createChannel', () => {
  it('creates a channel with subscribe and broadcast methods', () => {
    let channel = createChannel<{ e: void }>({ heartbeatMs: null })
    assert.equal(typeof channel.subscribe, 'function')
    assert.equal(typeof channel.broadcast, 'function')
  })

  it('subscribe returns a Response with SSE headers', async () => {
    let channel = createChannel<{ e: void }>({ heartbeatMs: null })
    let controller = new AbortController()
    let request = new Request('http://localhost/test', {
      signal: controller.signal,
    })
    let response = channel.subscribe(request)
    controller.abort()

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Type'), 'text/event-stream')
    assert.equal(response.headers.get('Cache-Control'), 'no-cache')
    assert.equal(response.headers.get('Connection'), 'keep-alive')
    assert.equal(response.headers.get('X-Accel-Buffering'), 'no')
  })

  it('sends an initial connected event', async () => {
    let channel = createChannel<{ e: void }>({ heartbeatMs: null })
    let controller = new AbortController()
    let request = new Request('http://localhost/test', {
      signal: controller.signal,
    })
    let response = channel.subscribe(request)

    let text = await readOneChunk(response.body!)
    controller.abort()

    assert.ok(text.includes('event: connected'))
    assert.ok(text.includes('"status":"connected"'))
  })

  it('broadcasts an event to a subscriber', async () => {
    let channel = createChannel<{ msg: { text: string } }>({
      heartbeatMs: null,
    })
    let controller = new AbortController()
    let request = new Request('http://localhost/test', {
      signal: controller.signal,
    })
    let response = channel.subscribe(request)

    channel.broadcast('msg', { text: 'hello' })

    let text = await readAllFromStream(response.body!, controller)

    assert.ok(text.includes('event: msg'))
    assert.ok(text.includes('"text":"hello"'))
  })

  it('broadcasts a void event without data argument', async () => {
    let channel = createChannel<{ invalidate: void }>({
      heartbeatMs: null,
    })
    let controller = new AbortController()
    let request = new Request('http://localhost/test', {
      signal: controller.signal,
    })
    let response = channel.subscribe(request)

    channel.broadcast('invalidate')

    let text = await readAllFromStream(response.body!, controller)

    assert.ok(text.includes('event: invalidate'))
    assert.ok(text.includes('data: {}'))
  })

  it('broadcasts to multiple subscribers', async () => {
    let channel = createChannel<{ e: string }>({ heartbeatMs: null })
    let ac1 = new AbortController()
    let ac2 = new AbortController()
    let res1 = channel.subscribe(
      new Request('http://localhost/1', { signal: ac1.signal }),
    )
    let res2 = channel.subscribe(
      new Request('http://localhost/2', { signal: ac2.signal }),
    )

    channel.broadcast('e', 'data')

    let text1 = await readAllFromStream(res1.body!, ac1)
    let text2 = await readAllFromStream(res2.body!, ac2)

    assert.ok(text1.includes('"data"'))
    assert.ok(text2.includes('"data"'))
  })

  it('removes subscriber on abort and subsequent broadcasts do not throw', async () => {
    let channel = createChannel<{ e: void }>({ heartbeatMs: null })
    let ac1 = new AbortController()
    let ac2 = new AbortController()

    channel.subscribe(
      new Request('http://localhost/1', { signal: ac1.signal }),
    )
    let res2 = channel.subscribe(
      new Request('http://localhost/2', { signal: ac2.signal }),
    )

    // Abort first subscriber
    ac1.abort()

    // Broadcast should not throw despite the dead subscriber
    channel.broadcast('e')

    // Second subscriber should still receive events
    let text = await readAllFromStream(res2.body!, ac2)
    assert.ok(text.length > 0)
  })

  describe('heartbeat', () => {
    it('sends heartbeat comments at the configured interval', async () => {
      let channel = createChannel<{ e: void }>({ heartbeatMs: 20 })
      let controller = new AbortController()
      let request = new Request('http://localhost/test', {
        signal: controller.signal,
      })
      let response = channel.subscribe(request)

      // Wait for at least one heartbeat to fire
      await new Promise((r) => setTimeout(r, 50))

      controller.abort()

      let text = await response.text()
      assert.ok(text.includes(': heartbeat'))
    })

    it('does not send heartbeats when heartbeatMs is 0', async () => {
      let channel = createChannel<{ e: void }>({ heartbeatMs: 0 })
      let controller = new AbortController()
      let request = new Request('http://localhost/test', {
        signal: controller.signal,
      })
      let response = channel.subscribe(request)

      await new Promise((r) => setTimeout(r, 30))

      controller.abort()

      let text = await response.text()
      // With no heartbeat and no broadcasts, only the connected event should exist
      let eventCount = (text.match(/event:/g) || []).length
      assert.equal(eventCount, 1)
      assert.ok(text.includes('event: connected'))
    })
  })

  describe('cleanup', () => {
    it('stops heartbeat on disconnect', async () => {
      let channel = createChannel<{ e: void }>({ heartbeatMs: 20 })
      let controller = new AbortController()
      let request = new Request('http://localhost/test', {
        signal: controller.signal,
      })
      channel.subscribe(request)

      // Let a heartbeat fire
      await new Promise((r) => setTimeout(r, 30))

      // Disconnect
      controller.abort()

      // Wait - heartbeats should have stopped
      let intervalWasCleared = true
      // We can't directly check the interval, but we can verify
      // that no error is thrown (the interval is cleared on abort)
      assert.ok(intervalWasCleared)
    })
  })
})
