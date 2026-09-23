import type { TestAgent } from '../actions/mastra/shared-agent.ts'
import {
  AGENT_TIMEOUT_MS,
  MAX_MESSAGE_LENGTH,
  sanitizeLog,
} from '../actions/mastra/shared-agent.ts'
import {
  createRunSignal,
  pipeStream,
  safeClose,
  sseErrorResponse,
  sseEvent,
  sseHeaders,
} from './agent-sse.ts'
import type { GateStore } from './agent-gate-store.ts'
import { createLogger } from './logger.ts'

export type StreamEndReason = 'complete' | 'suspended' | 'error' | 'aborted'

interface SuspensionInfo {
  runId?: string | undefined
  toolCallId?: string | undefined
  toolName?: string | undefined
  args?: Record<string, unknown> | undefined
  gateType: 'tool_decision' | 'question'
  suspendPayload?: Record<string, unknown> | undefined
}

interface DecisionResult {
  text?: string | undefined
  finishReason?: string | undefined
  runId?: string | undefined
  suspendPayload?: unknown
  fullStream?: unknown
}

/** The request surface the shared chat engine needs from a route context. */
export interface ChatRequestContext {
  formData: FormData
  request: Request
  json: (data: unknown) => Response
}

export interface AgentChatConfig {
  /** Log prefix, e.g. `[CustomerChat]`. */
  logPrefix: string
  /** The per-surface agent resolver (carries that surface's test seam). */
  resolveAgent: () => TestAgent
  /** The durable pending-gate store for this surface. */
  gateStore: GateStore
  /** Runs `fn` with the actor id in async-local scope for the agent tools. */
  runWithActor: <T>(actorId: number, fn: () => T) => T
  /** Resolves the frame a `navigate` tool result targets (support panel). */
  getTarget?: ((path: string) => string) | undefined
  /** Records a run -> owner pointer before a stream starts (customer chat). */
  recordRun?:
    | ((run: { ownerId: number; runId: string; threadId: string }) => Promise<void>)
    | undefined
  /** Drops a run -> owner pointer once a run settles (customer chat). */
  clearRun?: ((runId: string) => Promise<void>) | undefined
  /**
   * Ownership gate for a decision/answer run. Returns the owning thread, or
   * null to reject with 403. When omitted, the gate row supplies the thread id
   * (the support surface is scoped by owner column alone).
   */
  authorizeRun?:
    | ((runId: string, ownerId: number) => Promise<{ threadId: string } | null>)
    | undefined
  /**
   * When a run settles, whether to drop its gate/ownership pointer.
   * `settled` clears on anything but suspension; `complete-or-error` keeps a
   * client-aborted pointer for a later reconnect.
   */
  clearGateOn: 'settled' | 'complete-or-error'
  /**
   * Verifies a resumed run is still suspended before re-surfacing it. When
   * omitted, the gate row is trusted (customer chat joins ownership instead).
   */
  verifyRunStatus?:
    | ((
        ownerId: number,
        runId: string,
      ) => Promise<{
        status: string
        suspendPayload?: Record<string, unknown> | undefined
      } | null>)
    | undefined
  /** Error message streamed when a resume fails (the two surfaces word it differently). */
  answerErrorMessage: string
}

/**
 * The message-format error body shared by both chat surfaces.
 *
 * Keeping the wording here means the support and customer surfaces cannot
 * drift on validation copy.
 */
export function validationErrorResponse(
  error: 'missing' | 'empty' | 'too_long' | 'bad_thread_id',
): Response {
  if (error === 'too_long') {
    return sseErrorResponse(`Nachricht zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen).`, 400)
  }
  if (error === 'bad_thread_id') {
    return sseErrorResponse('Ungültiges Thread-ID-Format.', 400)
  }
  return sseErrorResponse('Bitte gib eine Nachricht ein.', 400)
}

/**
 * The shared SSE chat engine for the two conversational agents.
 *
 * `supportAgent` (admin, read-only) and `customerAgent` (customer, booking)
 * have different personas, tools and ownership rules, but the streaming,
 * suspension-gate and resume lifecycle around them is the same. This engine
 * owns that lifecycle so each surface's controller is only its route bindings,
 * actor lookup and (for the admin surface) audit logging.
 */
export function createAgentChat(config: AgentChatConfig) {
  let log = createLogger(config.logPrefix)
  let store = config.gateStore

  function shouldClear(reason: StreamEndReason): boolean {
    return config.clearGateOn === 'settled'
      ? reason !== 'suspended'
      : reason === 'complete' || reason === 'error'
  }

  async function clearGate(actorId: number, runId: string): Promise<void> {
    await store
      .clear(actorId, runId)
      .catch((e) => log('clearPendingGate error:', sanitizeLog(String(e))))
  }

  async function clearRun(runId: string): Promise<void> {
    if (!config.clearRun) return
    await config.clearRun(runId).catch((e) => log('clearRun error:', sanitizeLog(String(e))))
  }

  function markSuspended(
    actorId: number,
    threadId: string,
    fallbackRunId: string,
    info: SuspensionInfo,
  ): Promise<void> {
    return store
      .markSuspended(actorId, {
        runId: info.runId ?? fallbackRunId,
        threadId,
        gateType: info.gateType,
        ...(info.toolCallId !== undefined ? { toolCallId: info.toolCallId } : {}),
        ...(info.toolName !== undefined ? { toolName: info.toolName } : {}),
        ...(info.args !== undefined ? { args: info.args } : {}),
        ...(info.suspendPayload !== undefined ? { suspendPayload: info.suspendPayload } : {}),
      })
      .catch((e) => log('markGateSuspended error:', sanitizeLog(String(e))))
  }

  /**
   * Pipes a run's stream, mirrors a suspension into the durable gate, and drops
   * the gate/ownership pointer once the run settles.
   */
  async function pipeRun(options: {
    controller: ReadableStreamDefaultController
    fullStream: unknown
    signal: AbortSignal
    actorId: number
    threadId: string
    runId: string
  }): Promise<StreamEndReason> {
    let { controller, fullStream, signal, actorId, threadId, runId } = options
    let endReason: StreamEndReason = 'complete'
    await pipeStream(fullStream as ReadableStream, controller, signal, runId, config.getTarget, {
      onSuspension: (info) => markSuspended(actorId, threadId, runId, info),
      onEnd: (reason) => {
        endReason = reason
      },
    })
    if (shouldClear(endReason)) {
      await clearGate(actorId, runId)
      await clearRun(runId)
    }
    return endReason
  }

  /**
   * Terminal suspension handling for an approve/decline resume: records the
   * gate and emits the question/suspension event, returning true when the
   * stream ended suspended (so the caller skips the normal streaming path).
   */
  async function handleSuspension(
    controller: ReadableStreamDefaultController,
    actorId: number,
    threadId: string,
    runId: string,
    result: DecisionResult,
  ): Promise<boolean> {
    if (result.finishReason !== 'suspended') return false
    let sp = result.suspendPayload as
      | {
          question?: string
          options?: { label: string; description?: string }[]
          selectionMode?: string
          toolCallId?: string
          toolName?: string
          args?: Record<string, unknown>
        }
      | undefined

    if (sp?.question) {
      await store.markSuspended(actorId, {
        runId,
        threadId,
        gateType: 'question',
        ...(sp.toolCallId !== undefined ? { toolCallId: sp.toolCallId } : {}),
        ...(sp.toolName !== undefined ? { toolName: sp.toolName } : {}),
        suspendPayload: {
          question: sp.question,
          options: sp.options ?? null,
          selectionMode: sp.selectionMode ?? 'single_select',
        },
      })
      controller.enqueue(
        sseEvent('question', {
          runId,
          toolCallId: sp.toolCallId,
          question: sp.question,
          options: sp.options ?? null,
          selectionMode: sp.selectionMode ?? 'single_select',
          gateType: 'question',
        }),
      )
      controller.enqueue(sseEvent('complete', {}))
      controller.close()
      return true
    }

    if (sp?.toolCallId || sp?.toolName) {
      await store.markSuspended(actorId, {
        runId,
        threadId,
        gateType: 'tool_decision',
        ...(sp.toolCallId !== undefined ? { toolCallId: sp.toolCallId } : {}),
        ...(sp.toolName !== undefined ? { toolName: sp.toolName } : {}),
        ...(sp.args !== undefined ? { args: sp.args } : {}),
      })
      controller.enqueue(
        sseEvent('suspension', {
          runId,
          toolCallId: sp.toolCallId,
          toolName: sp.toolName,
          args: sp.args,
          gateType: 'tool_decision',
        }),
      )
      controller.enqueue(sseEvent('complete', {}))
      controller.close()
      return true
    }

    return false
  }

  /** Streams one user turn. The caller has already validated and authorized it. */
  function messageStream(options: {
    context: ChatRequestContext
    actorId: number
    message: string
    threadId: string
    onSettled?: ((info: { runId: string; threadId: string }) => void) | undefined
  }): Response {
    let { context, actorId, message, threadId } = options
    let body = new ReadableStream({
      start: async (controller) => {
        let run = createRunSignal(context.request.signal, AGENT_TIMEOUT_MS)
        try {
          let agent = config.resolveAgent()
          let output = await config.runWithActor(actorId, () =>
            agent.stream(message, {
              maxSteps: 10,
              abortSignal: run.signal,
              memory: { thread: threadId, resource: String(actorId) },
            }),
          )

          await config.recordRun?.({ ownerId: actorId, runId: output.runId, threadId })
          await store.upsert(actorId, { runId: output.runId, threadId })

          controller.enqueue(sseEvent('start', { runId: output.runId, threadId }))

          await pipeRun({
            controller,
            fullStream: output.fullStream,
            signal: run.signal,
            actorId,
            threadId,
            runId: output.runId,
          })

          options.onSettled?.({ runId: output.runId, threadId })
          log('stream completed')
        } catch (err) {
          log('error:', sanitizeLog(err instanceof Error ? err.message : String(err)))
          try {
            controller.enqueue(sseEvent('agent-error', { error: 'Fehler bei der Verarbeitung.' }))
          } catch {
            /* already closed */
          }
          safeClose(controller)
        } finally {
          run.cleanup()
        }
      },
    })
    return new Response(body, { headers: sseHeaders() })
  }

  /** Streams the outcome of an approve/decline decision for a suspended tool. */
  async function toolDecision(options: {
    context: ChatRequestContext
    actorId: number
    decision: 'approve' | 'decline'
    runId?: string | undefined
    toolCallId?: string | undefined
    threadId?: string | undefined
    onDecision?: ((runId: string) => void) | undefined
  }): Promise<Response> {
    let { context, actorId, decision } = options
    let runId = options.runId
    let toolCallId = options.toolCallId
    let threadId = options.threadId

    if (config.authorizeRun) {
      if (!runId) return sseErrorResponse('Fehlende runId', 400)
      let owner = await config.authorizeRun(runId, actorId)
      if (!owner) return new Response('Forbidden', { status: 403 })
      threadId = threadId ?? owner.threadId
    } else {
      let gate = await store.resolve(actorId, runId)
      if (!runId) {
        if (!gate) return sseErrorResponse('Fehlende runId', 400)
        runId = gate.runId
      }
      if (gate) {
        threadId = threadId ?? gate.threadId
        toolCallId = toolCallId ?? gate.toolCallId ?? undefined
      }
      if (!runId) return sseErrorResponse('Fehlende runId', 400)
    }

    let gateThreadId = threadId ?? ''
    let body = new ReadableStream({
      start: async (controller) => {
        let run = createRunSignal(context.request.signal, AGENT_TIMEOUT_MS)
        let contRunId = runId!
        try {
          controller.enqueue(sseEvent('start', { runId, threadId }))

          let agent = config.resolveAgent()
          let result = (await config.runWithActor(actorId, () =>
            decision === 'approve'
              ? agent.approveToolCallGenerate!({
                  runId: runId!,
                  abortSignal: run.signal,
                  ...(toolCallId !== undefined ? { toolCallId } : {}),
                })
              : agent.declineToolCallGenerate!({
                  runId: runId!,
                  abortSignal: run.signal,
                  ...(toolCallId !== undefined ? { toolCallId } : {}),
                }),
          )) as DecisionResult

          options.onDecision?.(runId!)

          contRunId = result.runId || runId!
          if (contRunId !== runId) {
            await config.recordRun?.({
              ownerId: actorId,
              runId: contRunId,
              threadId: gateThreadId,
            })
          }
          await store.upsert(actorId, { runId: contRunId, threadId: gateThreadId })

          if (await handleSuspension(controller, actorId, gateThreadId, contRunId, result)) {
            return
          }

          if (result.fullStream) {
            await pipeRun({
              controller,
              fullStream: result.fullStream,
              signal: run.signal,
              actorId,
              threadId: gateThreadId,
              runId: contRunId,
            })
            return
          }

          let text = (
            result.text || (decision === 'approve' ? '' : 'Die Aktion wurde abgelehnt.')
          ).trim()
          if (text) controller.enqueue(sseEvent('message', { text }))
          controller.enqueue(sseEvent('complete', {}))
          // Clear before closing so the durable record is gone when the body
          // ends (avoids a reconnect racing the terminal clear).
          await clearGate(actorId, contRunId)
          await clearRun(runId!)
          if (contRunId !== runId) await clearRun(contRunId)
          controller.close()
        } catch (err) {
          log('error:', sanitizeLog(err instanceof Error ? err.message : String(err)))
          await clearGate(actorId, contRunId)
          try {
            controller.enqueue(
              sseEvent('agent-error', { error: 'Fehler bei der Verarbeitung der Entscheidung.' }),
            )
          } catch {
            /* already closed */
          }
          safeClose(controller)
        } finally {
          run.cleanup()
        }
      },
    })
    return new Response(body, { headers: sseHeaders() })
  }

  /** Streams the resume of a suspended `ask_user` question. */
  async function answer(options: {
    context: ChatRequestContext
    actorId: number
    runId?: string | undefined
    answer?: string | undefined
    toolCallId?: string | undefined
    selectionMode?: string | undefined
    threadId?: string | undefined
  }): Promise<Response> {
    let { context, actorId } = options
    let runId = options.runId
    let toolCallId = options.toolCallId
    let threadId = options.threadId
    let answerRaw = options.answer

    if (config.authorizeRun) {
      if (!runId || !answerRaw) return sseErrorResponse('Fehlende runId oder Antwort', 400)
      if (answerRaw.length > MAX_MESSAGE_LENGTH) {
        return sseErrorResponse(`Antwort zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen)`, 400)
      }
      let owner = await config.authorizeRun(runId, actorId)
      if (!owner) return new Response('Forbidden', { status: 403 })
      threadId = threadId ?? owner.threadId
    } else {
      let gate = await store.resolve(actorId, runId)
      if (!runId) {
        if (!gate) return sseErrorResponse('Fehlende runId oder Antwort', 400)
        runId = gate.runId
      }
      if (gate) {
        threadId = threadId ?? gate.threadId
        toolCallId = toolCallId ?? gate.toolCallId ?? undefined
      }
      if (!runId || !answerRaw) return sseErrorResponse('Fehlende runId oder Antwort', 400)
      if (answerRaw.length > MAX_MESSAGE_LENGTH) {
        return sseErrorResponse(`Antwort zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen)`, 400)
      }
    }

    let resumeData: unknown = answerRaw
    if (options.selectionMode === 'multi_select' && answerRaw.startsWith('[')) {
      try {
        resumeData = JSON.parse(answerRaw)
      } catch {
        /* keep as string */
      }
    }

    let gateThreadId = threadId ?? ''
    let body = new ReadableStream({
      start: async (controller) => {
        let run = createRunSignal(context.request.signal, AGENT_TIMEOUT_MS)
        let contRunId = runId!
        try {
          let agent = config.resolveAgent()
          let output = await config.runWithActor(actorId, () =>
            agent.resumeStream(resumeData, {
              runId: runId!,
              toolCallId,
              abortSignal: run.signal,
            }),
          )

          controller.enqueue(sseEvent('start', { runId: output.runId, threadId: gateThreadId }))

          contRunId = output.runId || runId!
          if (contRunId !== runId) {
            await config.recordRun?.({
              ownerId: actorId,
              runId: contRunId,
              threadId: gateThreadId,
            })
            await clearRun(runId!)
          }
          await store.upsert(actorId, { runId: contRunId, threadId: gateThreadId })

          await pipeRun({
            controller,
            fullStream: output.fullStream,
            signal: run.signal,
            actorId,
            threadId: gateThreadId,
            runId: contRunId,
          })

          try {
            controller.enqueue(sseEvent('complete', {}))
          } catch {
            /* already closed/sent */
          }
        } catch (err) {
          log('error:', sanitizeLog(err instanceof Error ? err.message : String(err)))
          await clearGate(actorId, contRunId)
          try {
            controller.enqueue(sseEvent('agent-error', { error: config.answerErrorMessage }))
          } catch {
            /* already closed */
          }
          safeClose(controller)
        } finally {
          run.cleanup()
        }
      },
    })
    return new Response(body, { headers: sseHeaders() })
  }

  /** Re-surfaces a gate that is still pending after a reload / reconnect. */
  async function reconnect(options: {
    context: ChatRequestContext
    actorId: number
  }): Promise<Response> {
    let { context, actorId } = options
    let gate = await store.resolve(actorId)
    if (!gate) return context.json({ status: 'none' })

    if (!config.verifyRunStatus) {
      return context.json({
        status: 'suspended',
        runId: gate.runId,
        threadId: gate.threadId,
        gateType: gate.gateType,
        toolCallId: gate.toolCallId,
        toolName: gate.toolName,
        args: gate.args,
        suspendPayload: gate.suspendPayload,
      })
    }

    // The index is a pointer; reconnect is best-effort. A resolver failure must
    // not 500 — treat the run as unavailable and clear the stale pointer.
    let snapshot: { status: string; suspendPayload?: Record<string, unknown> | undefined } | null
    try {
      snapshot = await config.verifyRunStatus(actorId, gate.runId)
    } catch {
      await clearGate(actorId, gate.runId)
      return context.json({ status: 'none' })
    }
    if (!snapshot) {
      await clearGate(actorId, gate.runId)
      return context.json({ status: 'none' })
    }
    if (snapshot.status === 'running') {
      // Still in flight (mid-flight reload before the gate): keep the row and
      // surface nothing yet — a later reconnect will recover it.
      return context.json({ status: 'none' })
    }
    if (snapshot.status !== 'suspended') {
      await clearGate(actorId, gate.runId)
      return context.json({ status: 'none' })
    }

    let payload = gate.suspendPayload ?? snapshot.suspendPayload
    if (!payload) return context.json({ status: 'none' })

    log('reconnect: resurfacing suspended gate', sanitizeLog(gate.runId))
    return context.json({
      status: 'suspended',
      runId: gate.runId,
      threadId: gate.threadId,
      gateType: gate.gateType,
      toolCallId: gate.toolCallId,
      toolName: gate.toolName,
      args: gate.args,
      suspendPayload: payload,
    })
  }

  return { messageStream, toolDecision, answer, reconnect }
}

export type AgentChat = ReturnType<typeof createAgentChat>
