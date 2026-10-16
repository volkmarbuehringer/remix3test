import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  createSupportAgentStreamController,
  type SupportAgentUiDelegate,
  type SupportAgentFrame,
} from './support-agent-controller.ts'

/** Pure state-machine tests, no DOM: the delegate records every call. */
describe('SupportAgentStreamController', () => {
  function make() {
    let recorded: Array<Record<string, unknown>> = []
    let delegate: SupportAgentUiDelegate = {
      showThinking: () => recorded.push({ op: 'showThinking' }),
      hideThinking: () => recorded.push({ op: 'hideThinking' }),
      appendAgentMessage: () => {
        recorded.push({ op: 'appendAgentMessage' })
        return document.createElement('div')
      },
      updateLastAgentMessage: (text) => recorded.push({ op: 'updateLastAgentMessage', text }),
      finalizeAgentMessage: () => recorded.push({ op: 'finalizeAgentMessage' }),
      clearAgentMessageEl: () => recorded.push({ op: 'clearAgentMessageEl' }),
      appendStatusMessage: (text, isError) =>
        recorded.push({ op: 'appendStatusMessage', text, isError }),
      appendUserMessage: (text) => recorded.push({ op: 'appendUserMessage', text }),
      setFormEnabled: (enabled) => recorded.push({ op: 'setFormEnabled', enabled }),
      showErrorWithRetry: (message) => recorded.push({ op: 'showErrorWithRetry', message }),
      setPreviewVisible: (visible, path) =>
        recorded.push({ op: 'setPreviewVisible', visible, path }),
      renderQuestionCard: (mount) => recorded.push({ op: 'renderQuestionCard', mount }),
      renderApprovalCard: (mount) => recorded.push({ op: 'renderApprovalCard', mount }),
      renderToolResult: (result) => recorded.push({ op: 'renderToolResult', result }),
      hasQuestionGate: () => false,
      hasApprovalGate: () => false,
      removeQuestionGate: () => recorded.push({ op: 'removeQuestionGate' }),
      removeApprovalGate: () => recorded.push({ op: 'removeApprovalGate' }),
    }
    let framesRequested: Array<string | null> = []
    let getActivePanelFrame = (): SupportAgentFrame | null => {
      framesRequested.push('panel')
      return null
    }
    let getFrame = (): SupportAgentFrame | null => {
      framesRequested.push('named')
      return null
    }
    let controller = createSupportAgentStreamController(delegate, {
      signal: new AbortController().signal,
      getActivePanelFrame,
      getFrame,
      reconnectHref: '/admin/support-agent/reconnect',
    })
    return { delegate, controller, framesRequested, calls: recorded }
  }

  function calls(
    state: { calls: Array<Record<string, unknown>> },
    op: string,
  ): Array<Record<string, unknown>> {
    return state.calls.filter((c) => c.op === op)
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

  it('failed turns are re-submitted through the retry state machine', async () => {
    let state = make()
    let requests: Array<{ url: string; method: string | null }> = []
    let failResponse = new Response('data: {"error":"kaputt"}\n', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
    let originalFetch = globalThis.fetch
    globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: String(url), method: init?.method ?? null })
      if (requests.length === 1) return failResponse
      return sseResponse([{ type: 'complete', data: JSON.stringify({}) }])
    }) as typeof fetch

    try {
      await state.controller.startStream('/admin/support-agent/too', { method: 'POST' })
      let errorRow = calls(state, 'showErrorWithRetry')[0] as Record<string, unknown>
      assert.ok(errorRow, 'a failed turn renders the retriable error row')
      assert.ok(String(errorRow.message).includes('kaputt'))

      state.calls.length = 0
      await state.controller.retry()
      // retry() fire-and-forgets its stream; give the (stubbed) fetch a tick.
      await new Promise((r) => setTimeout(r, 20))
      assert.equal(requests.length, 2, 'retry re-submits')
      assert.deepEqual(
        { url: requests[1]!.url, method: requests[1]!.method },
        {
          url: '/admin/support-agent/too',
          method: 'POST',
        },
      )
      assert.deepEqual(
        calls(state, 'setFormEnabled').map((c) => c.enabled),
        [false, true],
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('a completed turn clears the retry submission and re-enables the composer', async () => {
    let state = make()
    let requests = 0
    let originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      requests++
      return sseResponse([
        { type: 'start', data: JSON.stringify({ runId: 'r-2' }) },
        { type: 'message', data: JSON.stringify({ text: 'Etwa so.' }) },
        { type: 'complete', data: JSON.stringify({}) },
      ])
    }) as typeof fetch
    try {
      await state.controller.startStream('/admin/support-agent', { method: 'POST' })
    } finally {
      globalThis.fetch = originalFetch
    }
    // The completion path must not leave a retry candidate for a satisfied turn.
    await state.controller.retry()
    assert.equal(requests, 1, 'retry() after completion submits nothing')
    assert.deepEqual(
      calls(state, 'setFormEnabled').map((c) => c.enabled),
      [true],
    )
  })
})
