import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import type { AgentStreamOutput, TestAgent } from '../actions/mastra/shared-agent.ts'
import type { GateStore } from './agent-gate-store.ts'
import { createDurableAgentChat, type DurableChatAgent } from './agent-chat-durable.ts'
import { createAgentChat } from './agent-chat.ts'
import { delay } from './async.ts'

// Since remix #12190 both boundaries cancel an abandoned response body: the
// router cancels the body of a response whose request was aborted, and the
// Node listener cancels the reader when the connection closes. Every server SSE
// stream must therefore dispose its producer from `cancel()`, not only from the
// request signal's abort handler. These tests cancel the body directly (the
// request signal stays live) and assert the run signal, timer and durable
// pointers are settled.

interface TestChatContext {
  formData: FormData
  request: Request
  json: (data: unknown) => Response
}

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function emptyStream(): ReadableStream {
  return new ReadableStream({
    start(controller) {
      controller.close()
    },
  })
}

function output(runId: string): AgentStreamOutput {
  return {
    runId,
    fullStream: emptyStream(),
    getFullOutput: async () => ({ text: '', finishReason: 'stop' }),
  }
}

function makeTestAgent(overrides: Partial<TestAgent> = {}): TestAgent {
  return {
    generate: async () => ({ text: '' }),
    stream: async () => output('run-1'),
    resumeStream: async () => output('run-1'),
    ...overrides,
  }
}

function makeGateStore() {
  let upserted: Array<{ ownerId: number; runId: string; threadId: string }> = []
  let cleared: Array<{ ownerId: number; runId: string }> = []
  let store: GateStore = {
    async upsert(ownerId, run) {
      upserted.push({ ownerId, runId: run.runId, threadId: run.threadId })
    },
    async markSuspended() {
      /* not exercised here */
    },
    async clear(ownerId, runId) {
      cleared.push({ ownerId, runId })
    },
    async resolve() {
      return null
    },
  }
  return { store, upserted, cleared }
}

function makeContext(): TestChatContext {
  let request = new Request('http://localhost/chat', { method: 'POST' })
  return { formData: new FormData(), request, json: (data) => Response.json(data) }
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  let start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await delay(10)
  }
  throw new Error('waitFor timed out')
}

/** The timeout id the run signal scheduled, captured through a setTimeout spy. */
function lastTimeoutId(calls: Array<{ result?: unknown }>): unknown {
  return calls.at(-1)?.result
}

function clearedTimer(clearCalls: Array<{ arguments: unknown[] }>, id: unknown): boolean {
  return clearCalls.some((call) => call.arguments[0] === id)
}

describe('createAgentChat stream cancellation', () => {
  it('cancelling the message body aborts the run, clears the timer and settles pointers', async (t) => {
    let setSpy = t.mock.method(globalThis, 'setTimeout')
    let clearSpy = t.mock.method(globalThis, 'clearTimeout')
    let release = deferred<AgentStreamOutput>()
    let seenAbort: AbortSignal | undefined
    let gates = makeGateStore()
    let recorded: string[] = []
    let clearedRuns: string[] = []
    let chat = createAgentChat({
      logPrefix: '[cancel-test]',
      resolveAgent: () =>
        makeTestAgent({
          stream: async (_message, opts) => {
            seenAbort = opts?.abortSignal as AbortSignal | undefined
            return release.promise
          },
        }),
      gateStore: gates.store,
      recordRun: async (run) => {
        recorded.push(run.runId)
      },
      clearRun: async (runId) => {
        clearedRuns.push(runId)
      },
      clearGateOn: 'settled',
      answerErrorMessage: 'Fehler bei der Antwortverarbeitung.',
    })

    let response = chat.messageStream({
      context: makeContext(),
      actorId: 7,
      message: 'hallo',
      threadId: 'thread-1',
    })
    let timeoutId = lastTimeoutId(setSpy.mock.calls)
    assert.ok(seenAbort, 'the agent must receive the run abort signal')
    assert.equal(seenAbort!.aborted, false, 'a live run must not be pre-aborted')

    await response.body!.cancel()

    assert.equal(seenAbort!.aborted, true, 'cancelling the body must abort the run')
    assert.ok(
      clearedTimer(clearSpy.mock.calls, timeoutId),
      'cancelling the body must clear the run timeout',
    )

    // The abandoned run still resolves; the cancelled body must settle the
    // durable ownership + gate rows instead of leaving them behind.
    release.resolve(output('run-cancel-1'))
    await waitFor(() => clearedRuns.includes('run-cancel-1'))
    assert.deepEqual(recorded, ['run-cancel-1'])
    assert.deepEqual(
      gates.upserted.map((row) => row.runId),
      ['run-cancel-1'],
    )
    assert.deepEqual(gates.cleared, [{ ownerId: 7, runId: 'run-cancel-1' }])
  })

  it('cancelling the decision body aborts the resume run', async () => {
    let release = deferred<Awaited<ReturnType<NonNullable<TestAgent['approveToolCallGenerate']>>>>()
    let seenAbort: AbortSignal | undefined
    let gates = makeGateStore()
    let chat = createAgentChat({
      logPrefix: '[cancel-test]',
      resolveAgent: () =>
        makeTestAgent({
          approveToolCallGenerate: async (opts) => {
            seenAbort = opts.abortSignal
            return release.promise
          },
        }),
      gateStore: gates.store,
      clearGateOn: 'settled',
      answerErrorMessage: 'Fehler bei der Antwortverarbeitung.',
    })

    let response = await chat.toolDecision({
      context: makeContext(),
      actorId: 7,
      decision: 'approve',
      runId: 'run-decision-1',
      toolCallId: 'tc-1',
    })
    await response.body!.cancel()

    assert.equal(seenAbort?.aborted, true, 'cancelling the body must abort the decision run')

    release.resolve({ text: 'Bestätigt.', finishReason: 'stop', runId: 'run-decision-1' })
    await waitFor(() => gates.cleared.length > 0)
    assert.deepEqual(gates.cleared, [{ ownerId: 7, runId: 'run-decision-1' }])
  })

  it('cancelling the answer body aborts the resume run', async () => {
    let release = deferred<AgentStreamOutput>()
    let seenAbort: AbortSignal | undefined
    let gates = makeGateStore()
    let chat = createAgentChat({
      logPrefix: '[cancel-test]',
      resolveAgent: () =>
        makeTestAgent({
          resumeStream: async (_data, opts) => {
            seenAbort = opts?.abortSignal as AbortSignal | undefined
            return release.promise
          },
        }),
      gateStore: gates.store,
      clearGateOn: 'settled',
      answerErrorMessage: 'Fehler bei der Antwortverarbeitung.',
    })

    let response = await chat.answer({
      context: makeContext(),
      actorId: 7,
      runId: 'run-answer-1',
      answer: 'Ja',
    })
    await response.body!.cancel()

    assert.equal(seenAbort?.aborted, true, 'cancelling the body must abort the answer run')

    release.resolve(output('run-answer-1'))
    await waitFor(() => gates.cleared.length > 0)
    assert.deepEqual(gates.cleared, [{ ownerId: 7, runId: 'run-answer-1' }])
  })
})

function makeDurableAgent(overrides: Partial<DurableChatAgent> = {}): DurableChatAgent {
  return {
    stream: async () => ({
      runId: 'run-1',
      output: { fullStream: emptyStream() },
      cleanup: () => {},
    }),
    resume: async () => ({
      runId: 'run-1',
      output: { fullStream: emptyStream() },
      cleanup: () => {},
    }),
    observe: async () => ({ output: { fullStream: emptyStream() }, detach: () => {} }),
    ...overrides,
  }
}

describe('createDurableAgentChat stream cancellation', () => {
  it('cancelling the message body aborts the run and records no ownership row', async (t) => {
    let setSpy = t.mock.method(globalThis, 'setTimeout')
    let clearSpy = t.mock.method(globalThis, 'clearTimeout')
    let release = deferred<Awaited<ReturnType<DurableChatAgent['stream']>>>()
    let seenAbort: AbortSignal | undefined
    let cleaned = false
    let recorded: string[] = []
    let cleared: string[] = []
    let chat = createDurableAgentChat({
      logPrefix: '[cancel-test]',
      resolveAgent: () =>
        makeDurableAgent({
          stream: async (_message, opts) => {
            seenAbort = opts?.abortSignal
            return release.promise
          },
        }),
      recordRun: async (run) => {
        recorded.push(run.runId)
      },
      clearRun: async (runId) => {
        cleared.push(runId)
      },
      authorizeRun: async () => ({ threadId: 'thread-1' }),
      findLatestRun: async () => null,
      answerErrorMessage: 'Fehler bei der Antwortverarbeitung.',
    })

    let response = chat.messageStream({
      context: makeContext(),
      actorId: 7,
      message: 'hallo',
      threadId: 'thread-1',
    })
    let timeoutId = lastTimeoutId(setSpy.mock.calls)

    await response.body!.cancel()

    assert.equal(seenAbort?.aborted, true, 'cancelling the body must abort the durable run')
    assert.ok(
      clearedTimer(clearSpy.mock.calls, timeoutId),
      'cancelling the body must clear the run timeout',
    )

    release.resolve({
      runId: 'run-durable-1',
      output: { fullStream: emptyStream() },
      cleanup: () => {
        cleaned = true
      },
    })
    await waitFor(() => cleaned)
    assert.deepEqual(recorded, [], 'a cancelled stream must not record an ownership row')
    assert.deepEqual(cleared, ['run-durable-1'], 'the run handle must still be disposed')
  })

  it('cancelling the decision body aborts the run and skips the continuation record', async () => {
    let release = deferred<Awaited<ReturnType<DurableChatAgent['resume']>>>()
    let seenAbort: AbortSignal | undefined
    let cleaned = false
    let recorded: string[] = []
    let cleared: string[] = []
    let chat = createDurableAgentChat({
      logPrefix: '[cancel-test]',
      resolveAgent: () =>
        makeDurableAgent({
          resume: async (_runId, _data, opts) => {
            seenAbort = opts?.abortSignal
            return release.promise
          },
        }),
      recordRun: async (run) => {
        recorded.push(run.runId)
      },
      clearRun: async (runId) => {
        cleared.push(runId)
      },
      authorizeRun: async () => ({ threadId: 'thread-1' }),
      findLatestRun: async () => null,
      answerErrorMessage: 'Fehler bei der Antwortverarbeitung.',
    })

    let response = await chat.toolDecision({
      context: makeContext(),
      actorId: 7,
      decision: 'approve',
      runId: 'run-decision-1',
      toolCallId: 'tc-1',
    })
    await response.body!.cancel()

    assert.equal(seenAbort?.aborted, true, 'cancelling the body must abort the durable resume')

    release.resolve({
      runId: 'run-continuation-1',
      output: { fullStream: emptyStream() },
      cleanup: () => {
        cleaned = true
      },
    })
    await waitFor(() => cleaned)
    assert.deepEqual(recorded, [], 'a cancelled stream must not record a continuation pointer')
    assert.deepEqual(cleared, ['run-decision-1', 'run-continuation-1'])
  })

  it('cancelling the answer body aborts the run and skips the continuation record', async () => {
    let release = deferred<Awaited<ReturnType<DurableChatAgent['resume']>>>()
    let seenAbort: AbortSignal | undefined
    let cleaned = false
    let recorded: string[] = []
    let chat = createDurableAgentChat({
      logPrefix: '[cancel-test]',
      resolveAgent: () =>
        makeDurableAgent({
          resume: async (_runId, _data, opts) => {
            seenAbort = opts?.abortSignal
            return release.promise
          },
        }),
      recordRun: async (run) => {
        recorded.push(run.runId)
      },
      clearRun: async () => {},
      authorizeRun: async () => ({ threadId: 'thread-1' }),
      findLatestRun: async () => null,
      answerErrorMessage: 'Fehler bei der Antwortverarbeitung.',
    })

    let response = await chat.answer({
      context: makeContext(),
      actorId: 7,
      runId: 'run-answer-1',
      answer: 'Ja',
    })
    await response.body!.cancel()

    assert.equal(seenAbort?.aborted, true, 'cancelling the body must abort the durable answer run')

    release.resolve({
      runId: 'run-answer-2',
      output: { fullStream: emptyStream() },
      cleanup: () => {
        cleaned = true
      },
    })
    await waitFor(() => cleaned)
    assert.deepEqual(recorded, [], 'a cancelled stream must not record a continuation pointer')
  })
})
