import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import {
  createCustomerChatController,
  type CustomerChatUiDelegate,
} from './customer-chat-controller.ts'

/**
 * Pure state-machine tests (no DOM): the controller routes SSE events and
 * turn lifecycle to a recording delegate. DOM decisions are the delegate's.
 */
describe('CustomerChatStreamController', () => {
  function recordingDelegate(): CustomerChatUiDelegate & {
    calls: Array<Record<string, unknown>>
  } {
    let recorded: Array<Record<string, unknown>> = []
    let delegate: CustomerChatUiDelegate & { calls: Array<Record<string, unknown>> } = {
      calls: recorded,
      appendMessage: (text, role, accumulate) =>
        recorded.push({ op: 'appendMessage', text, role, accumulate }),
      setBusy: (busy) => recorded.push({ op: 'setBusy', busy }),
      setFormEnabled: (enabled) => recorded.push({ op: 'setFormEnabled', enabled }),
      focusComposer: () => recorded.push({ op: 'focusComposer' }),
      beginTurn: () => recorded.push({ op: 'beginTurn' }),
      endStreamingBubble: () => recorded.push({ op: 'endStreamingBubble' }),
      showApproval: (data) => recorded.push({ op: 'showApproval', data }),
      hideApproval: () => recorded.push({ op: 'hideApproval' }),
      showQuestion: (data) => recorded.push({ op: 'showQuestion', data }),
      hideQuestion: () => recorded.push({ op: 'hideQuestion' }),
      focusApprovalButton: () => recorded.push({ op: 'focusApprovalButton' }),
      focusQuestionOption: () => recorded.push({ op: 'focusQuestionOption' }),
      appendToolCard: (toolName, toolCallId) =>
        recorded.push({ op: 'appendToolCard', toolName, toolCallId }),
      updateToolArgs: (toolCallId, argsTextDelta) =>
        recorded.push({ op: 'updateToolArgs', toolCallId, argsTextDelta }),
      finalizeToolArgs: (toolCallId, args) =>
        recorded.push({ op: 'finalizeToolArgs', toolCallId, args }),
      appendToolResult: (toolCallId, result, isError, toolName) =>
        recorded.push({ op: 'appendToolResult', toolCallId, result, isError, toolName }),
      appendStepStats: (reason, usage) => recorded.push({ op: 'appendStepStats', reason, usage }),
      startReasoning: () => recorded.push({ op: 'startReasoning' }),
      appendReasoning: (text) => recorded.push({ op: 'appendReasoning', text }),
      endReasoning: () => recorded.push({ op: 'endReasoning' }),
      getThreadIdFromDom: () => 'dom-thread',
    }
    delegate.calls = recorded
    return delegate
  }

  function make() {
    let delegate = recordingDelegate()
    let controller = createCustomerChatController(delegate, {
      lifecycleSignal: null,
      reconnectHref: '/chat/reconnect',
    })
    return { delegate, controller }
  }

  function calls(delegate: { calls: Array<Record<string, unknown>> }, op: string) {
    return delegate.calls.filter((c) => c.op === op)
  }

  it('start adopts run/thread ids and resets per-turn state', () => {
    let { delegate, controller } = make()
    controller.handleEvent('start', { runId: 'r-1', threadId: 't-1' })
    assert.deepEqual(
      delegate.calls.map((c) => c.op),
      ['beginTurn', 'hideQuestion'],
    )
    controller.handleEvent('message', { text: 'Hallo' })
    let appended = calls(delegate, 'appendMessage')[0]
    assert.deepEqual(appended, {
      op: 'appendMessage',
      text: 'Hallo',
      role: 'assistant',
      accumulate: true,
    })
    assert.deepEqual(calls(delegate, 'setBusy')[0], { op: 'setBusy', busy: false })
  })

  it('suspension shows the approval gate with run fallback and focuses it', () => {
    let { delegate, controller } = make()
    controller.handleEvent('start', { runId: 'r-2' })
    delegate.calls.length = 0
    controller.handleEvent('suspension', { toolName: 'book', args: { summary: 'x' } })
    let shown = calls(delegate, 'showApproval')[0] as { data: { runId: string; toolName?: string } }
    assert.equal(shown.data.runId, 'r-2', 'falls back to the run id adopted from start')
    assert.equal(shown.data.toolName, 'book')
    assert.deepEqual(
      delegate.calls.map((c) => c.op),
      ['showApproval', 'focusApprovalButton', 'endStreamingBubble'],
    )
  })

  it('question shows the gate and focuses the first option', () => {
    let { delegate, controller } = make()
    controller.handleEvent('start', { runId: 'r-3' })
    delegate.calls.length = 0
    controller.handleEvent('question', {
      question: 'Welcher Termin?',
      selectionMode: 'single_select',
    })
    let shown = calls(delegate, 'showQuestion')[0] as {
      data: { question: string; selectionMode: string }
    }
    assert.equal(shown.data.question, 'Welcher Termin?')
    assert.equal(shown.data.selectionMode, 'single_select')
    assert.ok(calls(delegate, 'focusQuestionOption').length === 1)
    assert.deepEqual(
      delegate.calls.map((c) => c.op),
      ['showQuestion', 'focusQuestionOption', 'endStreamingBubble'],
    )
  })

  it('routes the tool pipeline: card, args delta, finalize, result, errors', () => {
    let { delegate, controller } = make()
    controller.handleEvent('tool-call-input-streaming-start', {
      toolName: 'posts_search',
      toolCallId: 'tc-1',
    })
    controller.handleEvent('tool-call-delta', { toolCallId: 'tc-1', argsTextDelta: '{"q":' })
    controller.handleEvent('tool-call', { toolCallId: 'tc-1', args: { q: 'beratung' } })
    controller.handleEvent('tool-result', { toolCallId: 'tc-1', result: { count: 3 } })
    controller.handleEvent('tool-error', { toolCallId: 'tc-9', error: 'kaputt', toolName: 'x' })
    assert.deepEqual(
      delegate.calls.map((c) => c.op),
      [
        'appendToolCard',
        'setBusy',
        'updateToolArgs',
        'finalizeToolArgs',
        'appendToolResult',
        'appendToolResult',
      ],
    )
    // tool-error path passes isError=true and the raw error.
    let errCall = calls(delegate, 'appendToolResult')[1]
    assert.deepEqual(errCall, {
      op: 'appendToolResult',
      toolCallId: 'tc-9',
      result: 'kaputt',
      isError: true,
      toolName: 'x',
    })
    // Deltas without both id and value are ignored.
    delegate.calls.length = 0
    controller.handleEvent('tool-call-delta', { toolCallId: 'tc-2' })
    controller.handleEvent('tool-call-delta', { argsTextDelta: 'x' })
    assert.equal(delegate.calls.length, 0, 'incomplete deltas are ignored')
  })

  it('reasoning events are routed to the reasoning delegate', () => {
    let { delegate, controller } = make()
    controller.handleEvent('reasoning-start', {})
    controller.handleEvent('reasoning-delta', { text: 'denke…' })
    controller.handleEvent('reasoning-end', {})
    assert.deepEqual(
      delegate.calls.map((c) => c.op),
      ['startReasoning', 'setBusy', 'appendReasoning', 'endReasoning'],
    )
  })

  it('threadFromPageWins adopts the DOM thread id and the form carries it', () => {
    let { controller } = make()
    // window.location is not defined in this node test; the fresh probe
    // resolves to "not fresh" and adoption from the DOM proceeds.
    let startingFresh = controller.threadFromPageWins()
    assert.equal(startingFresh, false)
    let formData = new FormData()
    controller.setThreadOnForm(formData)
    assert.equal(formData.get('threadId'), 'dom-thread')
  })

  it('reconnect adopts the suspended gate from the probe endpoint', async () => {
    let { delegate, controller } = make()
    let originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: 'suspended',
          runId: 'run-q',
          threadId: 'thread-q',
          gateType: 'question',
          suspendPayload: { question: 'Bitte beantworten Sie die Frage.' },
        }),
        { status: 200 },
      )) as typeof fetch
    try {
      await controller.reconnect()
    } finally {
      globalThis.fetch = originalFetch
    }
    let shown = calls(delegate, 'showQuestion')[0] as {
      data: { runId: string; threadId?: string; selectionMode: string }
    }
    assert.equal(shown.data.runId, 'run-q')
    assert.equal(shown.data.threadId, 'thread-q')
    assert.equal(shown.data.selectionMode, 'single_select')
    assert.deepEqual(calls(delegate, 'setFormEnabled')[0], { op: 'setFormEnabled', enabled: false })
  })
})
