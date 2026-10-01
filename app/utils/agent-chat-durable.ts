import type { RequestContext } from '@mastra/core/request-context'
import {
  AGENT_TIMEOUT_MS,
  MAX_MESSAGE_LENGTH,
  sanitizeLog,
} from '../actions/mastra/shared-agent.ts'
import { createActorRequestContext } from '../actions/mastra/actor-context.ts'
import {
  createRunSignal,
  pipeStream,
  safeClose,
  sseErrorResponse,
  sseEvent,
  sseHeaders,
} from './agent-sse.ts'
import { createLogger } from './logger.ts'

// ── Durable agent surface ──────────────────────────────────────────
//
// The customer chat can run on a Mastra durable agent
// (`createDurableAgent()`, added in @mastra/core 1.45.0) instead of the
// hand-rolled resumable-stream / suspension-gate engine in agent-chat.ts. The
// durable agent runs the agentic loop inside a workflow, publishes chunks over
// PubSub and persists run state, so `observe()` can re-attach after a reload and
// `resume()` answers a suspension.
//
// Only the structural subset this app calls is declared here, so a test mock
// and the real `DurableAgent` both satisfy it without importing vendor generics.

/** Suspension payload emitted by a durable run's `onSuspended` callback. */
export interface DurableSuspensionData {
  toolCallId?: string | undefined
  toolName?: string | undefined
  args?: Record<string, unknown> | undefined
  suspendPayload?: unknown
  type?: 'approval' | 'suspension' | undefined
}

/** Options accepted by `DurableAgent.stream()` that this app uses. */
export interface DurableStreamOptions {
  maxSteps?: number
  abortSignal?: AbortSignal
  memory?: { thread: string; resource: string }
  requestContext?: RequestContext
  requireToolApproval?: boolean
  closeOnSuspend?: boolean
  onSuspended?: (data: DurableSuspensionData) => void | Promise<void>
}

/** Options accepted by `DurableAgent.resume()` that this app uses. */
export interface DurableResumeOptions {
  toolCallId?: string
  abortSignal?: AbortSignal
  requestContext?: RequestContext
}

/** Options accepted by `DurableAgent.observe()` that this app uses. */
export interface DurableObserveOptions {
  offset?: number
  idleTimeoutMs?: number
  isAlive?: () => boolean | Promise<boolean>
  onSuspended?: (data: DurableSuspensionData) => void | Promise<void>
}

export interface DurableChatStreamResult {
  output: { fullStream: ReadableStream }
  runId: string
  cleanup: () => void
}

export interface DurableChatObserveResult {
  output: { fullStream: ReadableStream }
  detach: () => void
}

/** A suspended tool call recovered from durable workflow snapshot storage. */
export interface DurableSuspendedToolCall {
  toolCallId: string
  toolName: string
  args?: unknown
  requiresApproval: boolean
  suspendPayload?: unknown
}

export interface DurableSuspendedRun {
  runId: string
  threadId?: string
  resourceId?: string
  toolCalls: DurableSuspendedToolCall[]
}

export interface DurableSuspendedRunsResult {
  runs: DurableSuspendedRun[]
  total: number
}

/**
 * The structural DurableAgent surface the customer chat engine calls. The real
 * value is a `DurableAgent` from `@mastra/core/agent/durable`.
 */
export interface DurableChatAgent {
  stream: (message: string, options?: DurableStreamOptions) => Promise<DurableChatStreamResult>
  resume: (
    runId: string,
    resumeData: unknown,
    options?: DurableResumeOptions,
  ) => Promise<DurableChatStreamResult>
  observe: (runId: string, options?: DurableObserveOptions) => Promise<DurableChatObserveResult>
  listSuspendedRuns?: (options?: {
    resourceId?: string
    threadId?: string
  }) => Promise<DurableSuspendedRunsResult>
}

/** The request surface the durable chat engine needs from a route context. */
interface DurableChatRequestContext {
  formData: FormData
  request: Request
  json: (data: unknown) => Response
}

type StreamEndReason = 'complete' | 'suspended' | 'error' | 'aborted'

/** A gate re-surfaced to the client after a reload. */
interface ReconnectGate {
  gateType: 'tool_decision' | 'question'
  threadId: string
  toolCallId: string | undefined
  toolName: string | undefined
  args: Record<string, unknown> | undefined
  suspendPayload: Record<string, unknown> | undefined
}

interface DurableAgentChatConfig {
  /** Log prefix, e.g. `[CustomerChat:durable]`. */
  logPrefix: string
  /** Resolves the registered durable agent (carries the surface's test seam). */
  resolveAgent: () => DurableChatAgent
  /** Records a run -> owner pointer before a stream starts. */
  recordRun: (run: { ownerId: number; runId: string; threadId: string }) => Promise<void>
  /** Drops a run -> owner pointer once a run settles. */
  clearRun: (runId: string) => Promise<void>
  /**
   * Ownership gate for a decision/answer/reconnect run. Returns the owning
   * thread, or null to reject. Never omitted: the durable path must not trust a
   * client-supplied run id alone.
   */
  authorizeRun: (runId: string, ownerId: number) => Promise<{ threadId: string } | null>
  /** Resolves the actor's most recent run id, so a reload can re-attach. */
  findLatestRun: (ownerId: number) => Promise<{ runId: string; threadId: string } | null>
  /** Resolves the frame a `navigate` tool result targets (unused for customer). */
  getTarget?: ((path: string) => string) | undefined
  /** Error message streamed when a resume fails. */
  answerErrorMessage: string
  /**
   * Call-site `requireToolApproval`. Durable agents accept only a boolean, and
   * `true` gates EVERY tool call; the customer agent's destructive tools already
   * set tool-level `requireApproval`, so this stays undefined for parity.
   */
  requireToolApproval?: boolean | undefined
  /** How long observe() replays a cached suspension before the storage fallback wins. */
  observeReplayWindowMs?: number
}

/**
 * The durable-agent chat engine for the customer surface.
 *
 * It keeps the same four entry points as the hand-rolled engine
 * (`messageStream`, `toolDecision`, `answer`, `reconnect`) and emits the same
 * SSE event vocabulary, so the browser contract and the controller stay
 * unchanged. The differences are all underneath:
 *
 * - the stream comes from `durableAgent.stream()` and exposes `{ output, runId, cleanup }`;
 * - a suspension leaves the ownership row in place and skips `cleanup()`, so a
 *   later `resume()` can still find the run in the in-process registry;
 * - reconnect re-attaches with `observe(runId)` and `detach()` (never
 *   `cleanup()`, which would destroy the suspended run other observers can see);
 * - the gate payload comes from durable workflow snapshot storage
 *   (`listSuspendedRuns`), so it survives a browser reload and a server restart.
 */
export function createDurableAgentChat(config: DurableAgentChatConfig) {
  let log = createLogger(config.logPrefix)
  let observeReplayWindowMs = config.observeReplayWindowMs ?? 300

  async function clearRun(runId: string): Promise<void> {
    await config.clearRun(runId).catch((e) => log('clearRun error:', sanitizeLog(String(e))))
  }

  /**
   * Pipes a durable run's fullStream, mapping the existing chunk vocabulary. A
   * suspension (tool approval or `ask_user`) is detected by the same
   * `tool-call-approval` / `tool-call-suspended` chunks the non-durable engine
   * emits, so the browser contract is unchanged.
   */
  async function pipeDurableRun(options: {
    controller: ReadableStreamDefaultController
    fullStream: ReadableStream
    signal: AbortSignal
    runId: string
  }): Promise<StreamEndReason> {
    let { controller, fullStream, signal, runId } = options
    let endReason: StreamEndReason = 'complete'
    await pipeStream(fullStream, controller, signal, runId, config.getTarget, {
      onSuspension: () => {
        /* The suspension chunk already carries the payload for the SSE event. */
      },
      onEnd: (reason) => {
        endReason = reason
      },
    })
    return endReason
  }

  /** Streams one user turn through the durable agent. */
  function messageStream(options: {
    context: DurableChatRequestContext
    actorId: number
    message: string
    threadId: string
    onSettled?: ((info: { runId: string; threadId: string }) => void) | undefined
  }): Response {
    let { context, actorId, message, threadId } = options
    let body = new ReadableStream({
      start: async (controller) => {
        let run = createRunSignal(context.request.signal, AGENT_TIMEOUT_MS)
        let runId: string | undefined
        let cleanup: (() => void) | undefined
        let endReason: StreamEndReason = 'error'
        try {
          let agent = config.resolveAgent()
          let result = await agent.stream(message, {
            maxSteps: 10,
            abortSignal: run.signal,
            memory: { thread: threadId, resource: String(actorId) },
            requestContext: createActorRequestContext(actorId),
            ...(config.requireToolApproval !== undefined
              ? { requireToolApproval: config.requireToolApproval }
              : {}),
            onSuspended: (data) => {
              log('suspended:', sanitizeLog(data.type ?? 'unknown'))
            },
          })
          runId = result.runId
          cleanup = result.cleanup

          await config.recordRun({ ownerId: actorId, runId: result.runId, threadId })
          controller.enqueue(sseEvent('start', { runId: result.runId, threadId }))

          endReason = await pipeDurableRun({
            controller,
            fullStream: result.output.fullStream,
            signal: run.signal,
            runId: result.runId,
          })

          options.onSettled?.({ runId: result.runId, threadId })
          log('stream completed')
        } catch (err) {
          endReason = 'error'
          log('error:', sanitizeLog(err instanceof Error ? err.message : String(err)))
          try {
            controller.enqueue(sseEvent('agent-error', { error: 'Fehler bei der Verarbeitung.' }))
          } catch {
            /* already closed */
          }
          safeClose(controller)
        } finally {
          if (endReason !== 'suspended') {
            if (runId) await clearRun(runId)
            cleanup?.()
          }
          run.cleanup()
        }
      },
    })
    return new Response(body, { headers: sseHeaders() })
  }

  /** Streams the outcome of an approve/decline decision via durable `resume()`. */
  async function toolDecision(options: {
    context: DurableChatRequestContext
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

    if (!runId) return sseErrorResponse('Fehlende runId', 400)
    let owner = await config.authorizeRun(runId, actorId)
    if (!owner) return new Response('Forbidden', { status: 403 })
    threadId = threadId ?? owner.threadId
    let gateThreadId = threadId

    let body = new ReadableStream({
      start: async (controller) => {
        let run = createRunSignal(context.request.signal, AGENT_TIMEOUT_MS)
        let contRunId = runId
        let cleanup: (() => void) | undefined
        let endReason: StreamEndReason = 'error'
        try {
          controller.enqueue(sseEvent('start', { runId, threadId: gateThreadId }))

          let agent = config.resolveAgent()
          let result = await agent.resume(
            runId,
            { approved: decision === 'approve' },
            {
              abortSignal: run.signal,
              requestContext: createActorRequestContext(actorId),
              ...(toolCallId !== undefined ? { toolCallId } : {}),
            },
          )
          cleanup = result.cleanup
          options.onDecision?.(runId)
          contRunId = result.runId || runId

          if (contRunId !== runId) {
            await config.recordRun({ ownerId: actorId, runId: contRunId, threadId: gateThreadId })
          }

          endReason = await pipeDurableRun({
            controller,
            fullStream: result.output.fullStream,
            signal: run.signal,
            runId: contRunId,
          })
        } catch (err) {
          endReason = 'error'
          log('error:', sanitizeLog(err instanceof Error ? err.message : String(err)))
          try {
            controller.enqueue(
              sseEvent('agent-error', { error: 'Fehler bei der Verarbeitung der Entscheidung.' }),
            )
          } catch {
            /* already closed */
          }
          safeClose(controller)
        } finally {
          if (endReason === 'suspended') {
            // A distinct continuation run takes over the pointer; a same-run
            // re-suspension keeps it so the follow-up decision is not a 403.
            if (contRunId !== runId) await clearRun(runId)
          } else {
            await clearRun(runId)
            if (contRunId !== runId) await clearRun(contRunId)
            cleanup?.()
          }
          run.cleanup()
        }
      },
    })
    return new Response(body, { headers: sseHeaders() })
  }

  /** Streams the resume of a suspended `ask_user` question via durable `resume()`. */
  async function answer(options: {
    context: DurableChatRequestContext
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

    if (!runId || !answerRaw) return sseErrorResponse('Fehlende runId oder Antwort', 400)
    if (answerRaw.length > MAX_MESSAGE_LENGTH) {
      return sseErrorResponse(`Antwort zu lang (maximal ${MAX_MESSAGE_LENGTH} Zeichen)`, 400)
    }
    let owner = await config.authorizeRun(runId, actorId)
    if (!owner) return new Response('Forbidden', { status: 403 })
    threadId = threadId ?? owner.threadId
    let gateThreadId = threadId

    let resumeData: unknown = answerRaw
    if (options.selectionMode === 'multi_select' && answerRaw.startsWith('[')) {
      try {
        resumeData = JSON.parse(answerRaw)
      } catch {
        /* keep as string */
      }
    }

    let body = new ReadableStream({
      start: async (controller) => {
        let run = createRunSignal(context.request.signal, AGENT_TIMEOUT_MS)
        let contRunId = runId
        let cleanup: (() => void) | undefined
        let endReason: StreamEndReason = 'error'
        try {
          let agent = config.resolveAgent()
          let result = await agent.resume(runId, resumeData, {
            abortSignal: run.signal,
            requestContext: createActorRequestContext(actorId),
            ...(toolCallId !== undefined ? { toolCallId } : {}),
          })
          cleanup = result.cleanup
          contRunId = result.runId || runId

          controller.enqueue(sseEvent('start', { runId: contRunId, threadId: gateThreadId }))

          if (contRunId !== runId) {
            await config.recordRun({ ownerId: actorId, runId: contRunId, threadId: gateThreadId })
          }

          endReason = await pipeDurableRun({
            controller,
            fullStream: result.output.fullStream,
            signal: run.signal,
            runId: contRunId,
          })
        } catch (err) {
          endReason = 'error'
          log('error:', sanitizeLog(err instanceof Error ? err.message : String(err)))
          try {
            controller.enqueue(sseEvent('agent-error', { error: config.answerErrorMessage }))
          } catch {
            /* already closed */
          }
          safeClose(controller)
        } finally {
          if (endReason === 'suspended') {
            if (contRunId !== runId) await clearRun(runId)
          } else {
            await clearRun(runId)
            if (contRunId !== runId) await clearRun(contRunId)
            cleanup?.()
          }
          run.cleanup()
        }
      },
    })
    return new Response(body, { headers: sseHeaders() })
  }

  /**
   * Re-attaches to the actor's pending run and re-surfaces its gate.
   *
   * The durable storage lookup (`listSuspendedRuns`) is the authoritative gate
   * source: it survives a server restart, unlike the in-process event cache that
   * backs `observe()`. `observe(runId)` is still used to re-attach and replay
   * the cached suspension for a bounded window; we always `detach()` and never
   * `cleanup()`, which would destroy a run the user is about to resume.
   */
  async function reconnect(options: {
    context: DurableChatRequestContext
    actorId: number
  }): Promise<Response> {
    let { context, actorId } = options
    let run = await config.findLatestRun(actorId)
    if (!run) return context.json({ status: 'none' })

    let owner = await config.authorizeRun(run.runId, actorId)
    if (!owner) return context.json({ status: 'none' })

    let gate = await findSuspendedGate(actorId, run.runId, owner.threadId)
    if (!gate) return context.json({ status: 'none' })

    let agent = config.resolveAgent()
    let ac = new AbortController()
    let onRequestAbort = () => ac.abort()
    if (context.request.signal.aborted) ac.abort()
    else context.request.signal.addEventListener('abort', onRequestAbort, { once: true })

    let observed: DurableSuspensionData | undefined
    let detach: (() => void) | undefined
    try {
      let result = await agent.observe(run.runId, {
        idleTimeoutMs: observeReplayWindowMs,
        onSuspended: (data) => {
          observed = data
        },
      })
      detach = result.detach
      await Promise.race([
        drainObserved(result.output.fullStream, () => observed !== undefined, ac.signal),
        new Promise<void>((resolve) => setTimeout(resolve, observeReplayWindowMs)),
      ])
    } catch (e) {
      log('observe error:', sanitizeLog(e instanceof Error ? e.message : String(e)))
    } finally {
      detach?.()
      context.request.signal.removeEventListener('abort', onRequestAbort)
    }

    let payload = observed ? gateFromSuspension(observed, run.threadId) : gate
    return context.json({
      status: 'suspended',
      runId: run.runId,
      threadId: payload.threadId,
      gateType: payload.gateType,
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      args: payload.args,
      suspendPayload: payload.suspendPayload,
    })
  }

  /** Durable-storage gate lookup, scoped to the actor's resource id. */
  async function findSuspendedGate(
    actorId: number,
    runId: string,
    fallbackThreadId: string,
  ): Promise<ReconnectGate | null> {
    try {
      let agent = config.resolveAgent()
      if (!agent.listSuspendedRuns) return null
      let { runs } = await agent.listSuspendedRuns({ resourceId: String(actorId) })
      let suspended = runs.find((r) => r.runId === runId)
      let toolCall = suspended?.toolCalls?.[0]
      if (!suspended || !toolCall) return null
      let threadId = suspended.threadId ?? fallbackThreadId
      if (toolCall.requiresApproval) {
        return {
          gateType: 'tool_decision',
          threadId,
          toolCallId: toolCall.toolCallId,
          toolName: toolCall.toolName,
          args: (toolCall.args as Record<string, unknown> | undefined) ?? undefined,
          suspendPayload: undefined,
        }
      }
      let sp = toolCall.suspendPayload as
        | { question?: string; options?: unknown; selectionMode?: unknown }
        | undefined
      if (!sp?.question) return null
      return {
        gateType: 'question',
        threadId,
        toolCallId: toolCall.toolCallId,
        toolName: toolCall.toolName,
        args: (toolCall.args as Record<string, unknown> | undefined) ?? undefined,
        suspendPayload: {
          question: sp.question,
          options: sp.options ?? null,
          selectionMode: sp.selectionMode ?? 'single_select',
        },
      }
    } catch (e) {
      log('listSuspendedRuns error:', sanitizeLog(e instanceof Error ? e.message : String(e)))
      return null
    }
  }

  /** Maps a replayed `onSuspended` payload onto the browser's gate shape. */
  function gateFromSuspension(
    data: DurableSuspensionData,
    fallbackThreadId: string,
  ): ReconnectGate {
    let sp = data.suspendPayload as
      | { question?: string; options?: unknown; selectionMode?: unknown }
      | undefined
    if (data.type === 'suspension' && sp?.question) {
      return {
        gateType: 'question',
        threadId: fallbackThreadId,
        toolCallId: data.toolCallId,
        toolName: data.toolName,
        args: data.args,
        suspendPayload: {
          question: sp.question,
          options: sp.options ?? null,
          selectionMode: sp.selectionMode ?? 'single_select',
        },
      }
    }
    return {
      gateType: 'tool_decision',
      threadId: fallbackThreadId,
      toolCallId: data.toolCallId,
      toolName: data.toolName,
      args: data.args,
      suspendPayload: undefined,
    }
  }

  return { messageStream, toolDecision, answer, reconnect }
}

/** Drains a replayed observe stream until the predicate is satisfied or it ends. */
async function drainObserved(
  fullStream: ReadableStream,
  isDone: () => boolean,
  signal: AbortSignal,
): Promise<void> {
  let reader = fullStream.getReader()
  try {
    while (!isDone() && !signal.aborted) {
      let { done } = await reader.read()
      if (done) break
    }
  } catch {
    /* replay is best-effort; the storage gate is the fallback */
  } finally {
    reader.cancel().catch(() => {})
  }
}
