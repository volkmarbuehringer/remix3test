import * as s from 'remix/data-schema'
import * as f from 'remix/data-schema/form-data'
import { validateThreadId } from '../../utils/thread-id.ts'

// ── Types ────────────────────────────────────────────────────────────

export interface AgentStreamOutput {
  runId: string
  fullStream: unknown
  getFullOutput: () => Promise<{
    text: string
    finishReason?: string
    toolCalls?: unknown[]
    toolResults?: unknown[]
    suspendPayload?: unknown
  }>
}

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
  stream: (message: string, opts?: any) => Promise<AgentStreamOutput>
  resumeStream: (data: unknown, opts?: any) => Promise<AgentStreamOutput>
  approveToolCallGenerate?: (opts: {
    runId: string
    toolCallId?: string
  }) => Promise<MastraSuspendableResult>
  declineToolCallGenerate?: (opts: {
    runId: string
    toolCallId?: string
  }) => Promise<MastraSuspendableResult>
}

export interface MastraSuspendableResult {
  finishReason?: string
  suspendPayload?: unknown
  text?: string
  runId?: string
  toolCalls?: unknown[]
  toolResults?: unknown[]
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

export function sanitizeLog(s: string): string {
  return s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f\r\n]/g, ' ').slice(0, 128)
}

export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError' || /abort/i.test(error.message))
  )
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
