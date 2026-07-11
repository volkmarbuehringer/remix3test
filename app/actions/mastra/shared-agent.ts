import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { validateThreadId } from '../../utils/thread-id.ts'

// ── Types ────────────────────────────────────────────────────────────

export interface TestAgent {
  generate: (
    message: string,
    opts?: Record<string, unknown>,
  ) => Promise<{
    text: string
    toolCalls?: unknown[]
    toolResults?: unknown[]
    finishReason?: string
    runId?: string
    suspendPayload?: unknown
  }>
  approveToolCallGenerate?: (opts: {
    runId: string
    toolCallId?: string
  }) => Promise<MastraSuspendableResult>
  declineToolCallGenerate?: (opts: {
    runId: string
    toolCallId?: string
  }) => Promise<MastraSuspendableResult>
}

export interface CapturedToolCall {
  name: string
  input: Record<string, unknown>
  result: unknown
  timestamp: number
}

export interface MastraSuspendableResult {
  finishReason?: string
  suspendPayload?: unknown
  text?: string
  runId?: string
  toolCalls?: unknown[]
  toolResults?: unknown[]
}

export function extractLastSlotResult(result: {
  toolResults?: unknown[]
}): Record<string, unknown> | undefined {
  for (let tr of (result.toolResults ?? []) as Array<Record<string, unknown>>) {
    let payload = (tr?.payload as Record<string, unknown>) ?? tr
    let toolName = payload?.toolName as string | undefined
    if (toolName === 'find_next_available_slots' || toolName === 'findNextAvailableSlots') {
      let r = payload?.result as Record<string, unknown> | undefined
      if (r?.slots && Array.isArray(r.slots) && (r.slots as unknown[]).length > 0) return r
    }
  }
  return undefined
}

// ── Schema ───────────────────────────────────────────────────────────

export const messageField = f.field(s.string())
export const messageSchema = f.object({
  message: messageField,
  threadId: f.field(s.optional(s.string())),
})

// ── Constants ────────────────────────────────────────────────────────

export const MAX_MESSAGE_LENGTH = 5000
export const AGENT_TIMEOUT_MS = 60_000

// ── Helpers ──────────────────────────────────────────────────────────

export function wantsJson(headers: Headers): boolean {
  return headers.get('Accept')?.includes('application/json') ?? false
}

export function sanitizeLog(s: string): string {
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\r\n]/g, ' ').slice(0, 128)
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError' || /abort/i.test(error.message))
  )
}

export function extractToolCalls(result: {
  toolCalls?: unknown[]
  toolResults?: unknown[]
}): CapturedToolCall[] {
  return (result.toolCalls ?? []).map((tc: unknown, i: number) => {
    let tcObj = tc as Record<string, unknown> | undefined
    let tr = (
      (result.toolResults ?? []) as unknown as Array<Record<string, unknown>> | undefined
    )?.[i]
    return {
      name: typeof tcObj?.toolName === 'string' ? tcObj.toolName : '',
      input: (typeof tcObj?.args === 'object' && tcObj.args != null ? tcObj.args : {}) as Record<
        string,
        unknown
      >,
      result: tr?.result,
      timestamp: Date.now(),
    }
  })
}

// ── Agent call with timeout ──────────────────────────────────────────

export interface CallAgentOptions {
  agent: TestAgent
  message: string
  threadId: string
  userId: string | number
  maxSteps?: number
  timeoutMs?: number
}

export interface AgentCallResult {
  text: string
  toolCalls: CapturedToolCall[]
  elapsed: number
  rawToolResults: unknown[]
  finishReason?: string
  runId?: string
  suspendPayload?: unknown
}

export async function callAgentWithTimeout(options: CallAgentOptions): Promise<AgentCallResult> {
  let { agent, message, threadId, userId, maxSteps = 10, timeoutMs = AGENT_TIMEOUT_MS } = options

  let startTime = Date.now()
  let abortController = new AbortController()
  let timeout = setTimeout(() => abortController.abort(), timeoutMs)

  try {
    let result = (await agent.generate(message, {
      maxSteps,
      abortSignal: abortController.signal,
      memory: {
        thread: threadId,
        resource: String(userId),
      },
    })) as Record<string, unknown>

    let elapsed = Date.now() - startTime
    let responseText = (result.text as string) ?? ''
    let capturedToolCalls = extractToolCalls(
      result as { toolCalls?: unknown[]; toolResults?: unknown[] },
    )
    let rawToolResults = (result.toolResults as unknown[]) ?? []

    return {
      text: responseText,
      toolCalls: capturedToolCalls,
      elapsed,
      rawToolResults,
      finishReason: result.finishReason as string | undefined,
      runId: result.runId as string | undefined,
      suspendPayload: result.suspendPayload as unknown | undefined,
    }
  } finally {
    clearTimeout(timeout)
  }
}

// ── Message validation ───────────────────────────────────────────────

export type ValidationError = 'missing' | 'empty' | 'too_long' | 'bad_thread_id'

export function validateMessage(
  formData: FormData,
): { ok: true; message: string; threadId?: string } | { ok: false; error: ValidationError } {
  let parsed = s.parseSafe(messageSchema, formData)
  if (!parsed.success) return { ok: false, error: 'missing' }

  let { message, threadId } = parsed.value
  if (!message || message.trim().length === 0) return { ok: false, error: 'empty' }
  if (message.length > MAX_MESSAGE_LENGTH) return { ok: false, error: 'too_long' }
  if (threadId && !validateThreadId(threadId)) return { ok: false, error: 'bad_thread_id' }

  return { ok: true, message, threadId }
}
