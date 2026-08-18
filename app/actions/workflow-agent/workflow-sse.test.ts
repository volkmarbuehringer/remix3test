import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { writeEvent, pipeWorkflowStream } from './workflow-sse.ts'

function makeSink() {
  let controller!: ReadableStreamDefaultController<Uint8Array>
  let stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c
    },
  })
  return { controller, stream }
}

async function drainAll(stream: ReadableStream): Promise<string> {
  let reader = stream.getReader()
  let parts: string[] = []
  try {
    while (true) {
      let { done, value } = await reader.read()
      if (done) break
      parts.push(new TextDecoder().decode(value))
    }
  } finally {
    reader.cancel()
  }
  return parts.join('')
}

function sourceOf(chunks: unknown[]): ReadableStream<unknown> {
  return new ReadableStream<unknown>({
    start(c) {
      for (let chunk of chunks) c.enqueue(chunk)
      c.close()
    },
  })
}

function stepResultChunk(output: Record<string, unknown>, id = 'step-final') {
  return { type: 'workflow-step-result', payload: { id, status: 'completed', output } }
}

const finalOutput = {
  success: true,
  action: 'lock',
  targetUserId: 42,
  targetUserName: 'Test User',
  targetUserEmail: 'test@example.com',
  deletedAppointments: 2,
  auditLogged: true,
}

describe('writeEvent', () => {
  it('encodes event type and JSON data as SSE', async () => {
    let sink = makeSink()
    writeEvent(sink.controller, 'workflow-start', { workflowId: 'wf-1' })
    sink.controller.close()
    let text = await drainAll(sink.stream)
    assert.ok(text.includes('event: workflow-start'))
    assert.ok(text.includes('data: {"workflowId":"wf-1"}'))
    assert.ok(text.includes('\n\n'), 'should terminate with blank line')
  })
})

describe('pipeWorkflowStream', () => {
  it('pipes a full run and returns the final workflow result', async () => {
    let source = sourceOf([
      { type: 'workflow-start', payload: { workflowId: 'userManagementWorkflow' } },
      { type: 'workflow-step-start', payload: { id: 'step-1' } },
      stepResultChunk(finalOutput),
      { type: 'workflow-finish', payload: { workflowStatus: 'success' } },
    ])
    let sink = makeSink()
    let result = await pipeWorkflowStream(source, sink.controller, new AbortController().signal)

    assert.equal(result?.success, true)
    assert.equal(result?.action, 'lock')
    assert.equal(result?.targetUserId, 42)
    assert.equal(result?.targetUserName, 'Test User')
    assert.equal(result?.targetUserEmail, 'test@example.com')
    assert.equal(result?.deletedAppointments, 2)
    assert.equal(result?.auditLogged, true)
    assert.equal(result?.error, undefined)

    let text = await drainAll(sink.stream)
    assert.ok(text.includes('event: workflow-start'))
    assert.ok(text.includes('"workflowId":"userManagementWorkflow"'))
    assert.ok(text.includes('event: workflow-step-start'))
    assert.ok(text.includes('event: workflow-step-result'))
    assert.ok(text.includes('event: workflow-finish'))
    assert.ok(text.includes('"success":true'))
  })

  it('captures reportPdf from step output and forwards it on finish', async () => {
    let source = sourceOf([
      stepResultChunk({
        success: true,
        targetUserName: 'Test User',
        reportPdf: 'data:application/pdf;base64,dGVzdA==',
        reportFilename: 'report-1.pdf',
      }),
      { type: 'workflow-finish', payload: { workflowStatus: 'success' } },
    ])
    let sink = makeSink()
    let result = await pipeWorkflowStream(source, sink.controller, new AbortController().signal)

    assert.equal(result?.success, true)

    let text = await drainAll(sink.stream)
    assert.ok(text.includes('"reportPdf":"data:application/pdf;base64,dGVzdA=="'))
    assert.ok(text.includes('"reportFilename":"report-1.pdf"'))
  })

  it('forwards step output events with their stepId', async () => {
    let source = sourceOf([
      { type: 'workflow-step-output', payload: { id: 'step-1', output: { foo: 'bar' } } },
    ])
    let sink = makeSink()
    await pipeWorkflowStream(source, sink.controller, new AbortController().signal)

    let text = await drainAll(sink.stream)
    assert.ok(text.includes('event: workflow-step-output'))
    assert.ok(text.includes('"stepId":"step-1"'))
    assert.ok(text.includes('"output":{"foo":"bar"}'))
  })

  it('forwards workflow-step-suspended events', async () => {
    let source = sourceOf([
      {
        type: 'workflow-step-suspended',
        payload: { id: 'step-2', suspendPayload: { question: 'Confirm?' } },
      },
    ])
    let sink = makeSink()
    await pipeWorkflowStream(source, sink.controller, new AbortController().signal)

    let text = await drainAll(sink.stream)
    assert.ok(text.includes('event: workflow-step-suspended'))
    assert.ok(text.includes('"stepId":"step-2"'))
    assert.ok(text.includes('"question":"Confirm?"'))
  })

  it('maps workflow-paused to workflow-step-suspended with unknown step', async () => {
    let source = sourceOf([{ type: 'workflow-paused', payload: {} }])
    let sink = makeSink()
    await pipeWorkflowStream(source, sink.controller, new AbortController().signal)

    let text = await drainAll(sink.stream)
    assert.ok(text.includes('event: workflow-step-suspended'))
    assert.ok(text.includes('"stepId":"unknown"'))
  })

  it('forwards workflow-canceled events', async () => {
    let source = sourceOf([{ type: 'workflow-canceled', payload: {} }])
    let sink = makeSink()
    await pipeWorkflowStream(source, sink.controller, new AbortController().signal)

    let text = await drainAll(sink.stream)
    assert.ok(text.includes('event: workflow-canceled'))
  })

  it('returns error result and forwards workflow-error when the stream throws', async () => {
    let source = new ReadableStream<unknown>({
      start(c) {
        c.error(new Error('boom'))
      },
    })
    let sink = makeSink()
    let result = await pipeWorkflowStream(source, sink.controller, new AbortController().signal)

    assert.equal(result?.success, false)
    assert.ok(result?.error?.includes('boom'), `unexpected error: ${result?.error}`)

    let text = await drainAll(sink.stream)
    assert.ok(text.includes('event: workflow-error'))
    assert.ok(text.includes('boom'))
  })

  it('returns null when the signal is already aborted and closes the controller', async () => {
    let source = sourceOf([{ type: 'workflow-start', payload: { workflowId: 'wf' } }])
    let sink = makeSink()
    let result = await pipeWorkflowStream(source, sink.controller, AbortSignal.abort())

    assert.equal(result, null)
    let text = await drainAll(sink.stream)
    assert.equal(text, '')
  })

  it('supports non-ReadableStream async iterables', async () => {
    async function* gen() {
      yield { type: 'workflow-start', payload: { workflowId: 'gen-wf' } }
      yield stepResultChunk({
        success: false,
        action: '',
        targetUserId: 0,
        targetUserName: 'Other User',
        targetUserEmail: '',
        error: 'workflow failed',
      })
      yield { type: 'workflow-finish', payload: { workflowStatus: 'failed' } }
    }
    let sink = makeSink()
    let result = await pipeWorkflowStream(gen(), sink.controller, new AbortController().signal)

    assert.equal(result?.success, false)
    assert.equal(result?.error, 'workflow failed')

    let text = await drainAll(sink.stream)
    assert.ok(text.includes('event: workflow-start'))
    assert.ok(text.includes('"workflowId":"gen-wf"'))
  })

  it('returns null when no final output chunk is seen', async () => {
    let source = sourceOf([
      { type: 'workflow-start', payload: { workflowId: 'wf' } },
      { type: 'workflow-finish', payload: { workflowStatus: 'success' } },
    ])
    let sink = makeSink()
    let result = await pipeWorkflowStream(source, sink.controller, new AbortController().signal)

    assert.equal(result, null)
  })

  it('ignores non-object chunks without crashing', async () => {
    let source = sourceOf([
      null,
      'string',
      42,
      { type: 'workflow-start', payload: { workflowId: 'wf' } },
    ])
    let sink = makeSink()
    await pipeWorkflowStream(source, sink.controller, new AbortController().signal)

    let text = await drainAll(sink.stream)
    assert.ok(text.includes('event: workflow-start'))
    assert.ok(!text.includes('event: workflow-error'))
  })
})
