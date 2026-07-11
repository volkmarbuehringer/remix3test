import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { setStream, getStream } from './stream-store.ts'
import type { StoredStream } from './stream-store.ts'

function makeFakeStream(runId: string): StoredStream {
  return {
    runId,
    fullStream: new ReadableStream({
      start(controller) {
        controller.enqueue({ type: 'text-delta', textDelta: 'hello world' })
        controller.enqueue({ type: 'finish', payload: {} })
        controller.close()
      },
    }) as unknown as StoredStream['fullStream'],
    getFullOutput: async () => ({
      text: 'hello world',
      finishReason: 'stop',
    }),
  }
}

describe('streamStore', () => {
  it('stores and retrieves a stream by runId', () => {
    let stream = makeFakeStream('run-1')
    setStream('run-1', stream)
    let retrieved = getStream('run-1')
    assert.ok(retrieved !== undefined, 'should retrieve the stream')
    assert.equal(retrieved!.runId, 'run-1')
  })

  it('returns undefined for a non-existent runId', () => {
    let retrieved = getStream('nonexistent')
    assert.equal(retrieved, undefined)
  })

  it('deletes the entry after retrieval (one-consumer semantics)', () => {
    let stream = makeFakeStream('run-2')
    setStream('run-2', stream)
    let first = getStream('run-2')
    assert.ok(first !== undefined, 'first retrieval should succeed')
    let second = getStream('run-2')
    assert.equal(second, undefined, 'second retrieval should return undefined')
  })
})
