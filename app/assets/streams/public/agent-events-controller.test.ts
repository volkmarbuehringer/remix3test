import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  createAgentEventsStreamController,
  type AgentEventsUiDelegate,
  type AgentEventsFrame,
} from './agent-events-controller.ts'

/** Pure state-machine tests, no DOM: the delegate records every call. */
describe('AgentEventsStreamController', () => {
  function make({ pipelineFrame = false }: { pipelineFrame?: boolean } = {}) {
    let recorded: Array<Record<string, unknown>> = []
    let replaced: string[] = []
    let delegate: AgentEventsUiDelegate = {
      showInfo: (text, opts) => recorded.push({ op: 'showInfo', text, kind: opts?.kind }),
      hideConfirmGate: () => recorded.push({ op: 'hideConfirmGate' }),
      renderConfirmGate: (payload, onConfirm, onCancel) =>
        recorded.push({ op: 'renderConfirmGate', payload, onConfirm, onCancel }),
      setFormEnabled: (enabled) => recorded.push({ op: 'setFormEnabled', enabled }),
      clearStatusBar: () => recorded.push({ op: 'clearStatusBar' }),
    }
    let dummyFrame: AgentEventsFrame = {
      replace: async (html) => {
        replaced.push(String(html))
      },
      reload: async () => {},
    }
    let controller = createAgentEventsStreamController(delegate, {
      getPipelineFrame: (): AgentEventsFrame | null => (pipelineFrame ? dummyFrame : null),
      getFrame: (): AgentEventsFrame | null => null,
      resumeHref: '/admin/agent-events/resume',
      reconnectHref: '/admin/agent-events/reconnect',
    })
    return { recorded, controller, replaced }
  }

  function calls(state: { recorded: Array<Record<string, unknown>> }, op: string) {
    return state.recorded.filter((c) => c.op === op)
  }

  function sseResponse(events: Array<{ type: string; data: string }>): Response {
    let encoder = new TextEncoder()
    let body = new ReadableStream({
      start(controller) {
        for (let { type, data } of events) {
          controller.enqueue(encoder.encode(`event: ${type}\ndata: ${data}\n\n`))
        }
        controller.close()
      },
    })
    return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
  }

  it('beginCommand resets run state and announces the run', async () => {
    let state = make()
    let formData = new FormData()
    let requests: Array<{ url: string; body: FormData | null }> = []
    let originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(url), body: (init?.body as FormData) ?? null })
      return sseResponse([{ type: 'complete', data: JSON.stringify({}) }])
    }) as typeof fetch
    try {
      state.controller.beginCommand('/admin/agent-events/command', formData)
      await new Promise((r) => setTimeout(r, 20))
      assert.equal(requests[0]!.url, '/admin/agent-events/command')
      assert.equal(requests[0]!.body, formData, 'the submitted FormData is the request body')
    } finally {
      globalThis.fetch = originalFetch
    }

    assert.deepEqual(
      state.recorded.slice(0, 4).map((c) => c.op),
      ['setFormEnabled', 'hideConfirmGate', 'clearStatusBar', 'showInfo'],
    )
    assert.deepEqual(state.recorded[0], { op: 'setFormEnabled', enabled: false })
    assert.deepEqual(state.recorded[3], {
      op: 'showInfo',
      text: 'Processing…',
      kind: 'active',
    })
    await new Promise((r) => setTimeout(r, 20))
    assert.equal(state.controller.hasRunPending(), false, 'complete clears the run')
  })

  it('beginCommand starts the stream; workflow-finish reports completion', async () => {
    let state = make({ pipelineFrame: true })
    let originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      sseResponse([
        { type: 'start', data: JSON.stringify({ runId: 'r-1', workflowId: 'w-1' }) },
        { type: 'status', data: JSON.stringify({ text: 'validating', kind: 'info' }) },
        { type: 'workflow-finish', data: JSON.stringify({ success: true }) },
      ])) as typeof fetch
    try {
      state.controller.beginCommand('/admin/agent-events', new FormData())
      await new Promise((r) => setTimeout(r, 20))
    } finally {
      globalThis.fetch = originalFetch
    }
    assert.ok(
      state.replaced[0]!.includes('Processing…'),
      'the Processing row is buffered into the pipeline frame',
    )
    assert.ok(state.replaced[1]!.includes('validating'), 'status rows buffer into the frame')
    let finished = calls(state, 'showInfo')[0] as Record<string, unknown>
    assert.deepEqual(finished, { op: 'showInfo', text: 'Action completed', kind: 'success' })
    assert.ok(calls(state, 'hideConfirmGate').length >= 1)
  })

  it('resume posts the adopted run/workflow ids and the decision', async () => {
    let state = make({ pipelineFrame: true })
    let requests: Array<{ url: string; body: FormData | null }> = []
    let originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(url), body: (init?.body as FormData) ?? null })
      return sseResponse([{ type: 'complete', data: JSON.stringify({}) }])
    }) as typeof fetch
    try {
      state.controller.beginCommand('/admin/agent-events', new FormData())
      await new Promise((r) => setTimeout(r, 20))

      // Adopt a suspended run via reconnect (idle now, so the gate renders).
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            status: 'suspended',
            runId: 'run-q',
            workflowId: 'wf-q',
            suspendPayload: { question: 'Confirm?' },
          }),
          { status: 200 },
        )) as typeof fetch
      await state.controller.reconnect(new AbortController().signal)
      let gate = calls(state, 'renderConfirmGate')[0] as {
        payload: Record<string, unknown>
      }
      assert.deepEqual(gate.payload, { question: 'Confirm?' })

      globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
        requests.push({ url: String(url), body: (init?.body as FormData) ?? null })
        return sseResponse([{ type: 'complete', data: JSON.stringify({}) }])
      }) as typeof fetch
      state.controller.resume(true)
      await new Promise((r) => setTimeout(r, 20))
    } finally {
      globalThis.fetch = originalFetch
    }

    let resume = requests[1]!
    assert.equal(resume.url, '/admin/agent-events/resume')
    assert.equal(resume.body!.get('runId'), 'run-q')
    assert.equal(resume.body!.get('workflowId'), 'wf-q')
    assert.equal(resume.body!.get('confirmed'), 'true')
    // The resume call re-disables the composer while the resumed turn streams.
    let gateIndex = state.recorded.findIndex((c) => c.op === 'renderConfirmGate')
    let nextEnabled = state.recorded.slice(gateIndex + 1).find((c) => c.op === 'setFormEnabled')
    assert.deepEqual(nextEnabled, { op: 'setFormEnabled', enabled: false })
  })

  it('reconnect is skipped while a stream is still in flight', async () => {
    let state = make()
    let streamController: ReadableStreamDefaultController | undefined
    let originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: RequestInfo | URL) => {
      if (String(url).includes('/reconnect')) {
        return new Response(
          JSON.stringify({
            status: 'suspended',
            runId: 'run-stale',
            suspendPayload: { question: 'Stale gate' },
          }),
          { status: 200 },
        )
      }
      let body = new ReadableStream({
        start(c) {
          streamController = c as ReadableStreamDefaultController
        },
      })
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })
    }) as typeof fetch
    try {
      state.controller.beginCommand('/admin/agent-events', new FormData())
      await new Promise((r) => setTimeout(r, 20))
      assert.ok(streamController, 'the hanging stream is open')

      await state.controller.reconnect(new AbortController().signal)
      assert.equal(calls(state, 'renderConfirmGate').length, 0, 'stale gate is dropped')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
