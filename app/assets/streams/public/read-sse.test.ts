import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { readEventStream } from './read-sse.ts'

/** Builds an SSE Response whose body is emitted in the given chunks. */
function sseResponse(chunks: string[]): Response {
  let encoder = new TextEncoder()
  let body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
}

describe('readEventStream', () => {
  it('parses JSON and raw frames, reassembling frames split across chunks', async () => {
    let events: [string, unknown][] = []
    await readEventStream(
      sseResponse([
        'event: status\ndata: {"text":"validated"}',
        '\n\nevent: message\ndata: plain',
        '\n\n',
      ]),
      (type, data) => {
        events.push([type, data])
      },
    )

    assert.deepEqual(events, [
      ['status', { text: 'validated' }],
      ['message', 'plain'],
    ])
  })

  it('skips empty frames', async () => {
    let events: string[] = []
    await readEventStream(sseResponse(['\n\nevent: a\ndata: 1\n\n\n\n']), (type) => {
      events.push(type)
    })

    assert.deepEqual(events, ['a'])
  })

  it('stops reading and returns true when the handler returns false', async () => {
    let seen: string[] = []
    let stopped = await readEventStream(
      sseResponse(['event: a\ndata: 1\n\nevent: b\ndata: 2\n\nevent: c\ndata: 3\n\n']),
      (type) => {
        seen.push(type)
        return type === 'b' ? false : undefined
      },
    )

    assert.deepEqual(seen, ['a', 'b'])
    assert.equal(stopped, true)
  })

  it('returns false when the stream is exhausted', async () => {
    let stopped = await readEventStream(sseResponse(['event: a\ndata: 1\n\n']), () => {})

    assert.equal(stopped, false)
  })

  it('does not dispatch and returns true when the signal is already aborted', async () => {
    let controller = new AbortController()
    controller.abort()
    let called = false
    let stopped = await readEventStream(
      sseResponse(['event: a\ndata: 1\n\n']),
      () => {
        called = true
      },
      { signal: controller.signal },
    )

    assert.equal(called, false)
    assert.equal(stopped, true)
  })
})
