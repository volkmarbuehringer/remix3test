import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  createSupportAgentStreamController,
  type SupportAgentUiDelegate,
  type SupportAgentFrame,
} from './support-agent-controller.ts'

/** Pure state-machine tests, no DOM: the delegate records every call. */
describe('SupportAgentStreamController', () => {
  function make({
    signal = new AbortController().signal,
    panelFrame = null,
  }: { signal?: AbortSignal; panelFrame?: SupportAgentFrame | null } = {}) {
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
      return panelFrame
    }
    let getFrame = (): SupportAgentFrame | null => {
      framesRequested.push('named')
      return null
    }
    let controller = createSupportAgentStreamController(delegate, {
      signal,
      getActivePanelFrame,
      getFrame,
      reconnectHref: '/admin/support-agent/reconnect',
    })
    return { delegate, controller, framesRequested, calls: recorded }
  }

  /**
   * A fetch stub that honors the passed `signal` like a real fetch: rejects
   * with an `AbortError` when the signal aborts (or is already aborted), and
   * otherwise stays pending — so a test controls when the request settles.
   */
  function abortableFetch(requests: string[]): typeof fetch {
    let abortError = () => {
      let err = new Error('The operation was aborted')
      err.name = 'AbortError'
      return err
    }
    return (async (url: RequestInfo | URL, init?: RequestInit) => {
      requests.push(String(url))
      return new Promise<Response>((_, reject) => {
        if (init?.signal?.aborted) {
          reject(abortError())
          return
        }
        init?.signal?.addEventListener('abort', () => reject(abortError()))
      })
    }) as typeof fetch
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

  /**
   * Node has no HTMLFormElement: `new FormData(fakeForm)` throws, so tests
   * that drive `frameFormSubmit` stub the constructor. The aborted paths only
   * construct the FormData — they never mutate it.
   */
  function stubFormData(): () => void {
    let original = globalThis.FormData
    globalThis.FormData = class {
      set(_name: string, _value: unknown) {}
    } as unknown as typeof FormData
    return () => {
      globalThis.FormData = original
    }
  }

  it('frameFormSubmit aborts with the component signal: marker cleared, no error row, no reload', async () => {
    let component = new AbortController()
    let reloaded = 0
    let state = make({
      signal: component.signal,
      panelFrame: {
        reload: async () => {
          reloaded++
        },
      },
    })
    let requests: string[] = []
    let originalFetch = globalThis.fetch
    let restoreFormData = stubFormData()
    globalThis.fetch = abortableFetch(requests)
    try {
      let form = { method: 'POST', action: '/admin/support-agent/panel-action' } as HTMLFormElement

      let pending = state.controller.frameFormSubmit(form)
      await new Promise((r) => setTimeout(r, 5))
      assert.equal(state.controller.frameFormBusy(), true, 'in-flight marker set while pending')
      assert.deepEqual(requests, ['/admin/support-agent/panel-action'])

      component.abort()
      await pending

      assert.equal(state.controller.frameFormBusy(), false, 'in-flight marker cleared after abort')
      assert.equal(reloaded, 0, 'no panel reload after an aborted submission')
      assert.deepEqual(
        calls(state, 'appendStatusMessage').filter((c) => c.isError),
        [],
        'an intentional abort is not reported as a failed submission',
      )
    } finally {
      globalThis.fetch = originalFetch
      restoreFormData()
    }
  })

  it('frameFormSubmit with an already-aborted component signal settles without an error row', async () => {
    let component = new AbortController()
    component.abort()
    let state = make({ signal: component.signal })
    let requests: string[] = []
    let originalFetch = globalThis.fetch
    let restoreFormData = stubFormData()
    globalThis.fetch = abortableFetch(requests)
    try {
      let form = { method: 'POST', action: '/admin/support-agent/panel-action' } as HTMLFormElement

      await state.controller.frameFormSubmit(form)

      assert.equal(state.controller.frameFormBusy(), false, 'in-flight marker cleared')
      assert.deepEqual(
        calls(state, 'appendStatusMessage').filter((c) => c.isError),
        [],
        'no error row when the component was already torn down',
      )
    } finally {
      globalThis.fetch = originalFetch
      restoreFormData()
    }
  })

  it('reconnect aborts with the component signal and renders no gate', async () => {
    let component = new AbortController()
    let state = make({ signal: component.signal })
    let requests: string[] = []
    let originalFetch = globalThis.fetch
    globalThis.fetch = abortableFetch(requests)
    try {
      let pending = state.controller.reconnect()
      await new Promise((r) => setTimeout(r, 5))
      assert.deepEqual(requests, ['/admin/support-agent/reconnect'])

      component.abort()
      await pending

      assert.deepEqual(calls(state, 'renderQuestionCard'), [], 'no question gate after abort')
      assert.deepEqual(calls(state, 'renderApprovalCard'), [], 'no approval gate after abort')
      assert.deepEqual(
        calls(state, 'setFormEnabled'),
        [],
        'the composer is left untouched after an aborted probe',
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
