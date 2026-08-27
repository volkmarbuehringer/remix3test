import { AGENT_TIMEOUT_MS } from './shared-agent.ts'
import { INTENTS } from '../agent-events/intents.ts'

export type ClassifyAgent = {
  generate: (message: string, opts?: { abortSignal?: AbortSignal }) => Promise<{ text?: string }>
}

export type ClassifyResult =
  | { intent: string; targetQuery: string; resourceQuery?: string }
  | { unclear: string }

const AGENT_ACTION_TO_INTENT: Record<string, string> = {
  'user-action:cancel': INTENTS.CANCEL_USER,
  'user-action:lock': INTENTS.LOCK_USER,
  'user-action:unlock': INTENTS.UNLOCK_USER,
  'appointment:check': INTENTS.SHOW_APPOINTMENTS,
  'appointment:delete-resource': INTENTS.DELETE_APPOINTMENTS,
}

export function parseIntentJson(
  text: string,
): { type?: unknown; action?: unknown; targetQuery?: unknown; resourceQuery?: unknown } | null {
  let start = text.indexOf('{')
  let end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch {
      /* fall through */
    }
  }
  return null
}

export async function classifyWithAgent(
  agent: ClassifyAgent,
  message: string,
  opts?: { timeoutMs?: number },
): Promise<ClassifyResult> {
  let result
  try {
    result = await agent.generate(message, {
      abortSignal: AbortSignal.timeout(opts?.timeoutMs ?? AGENT_TIMEOUT_MS),
    })
  } catch (err) {
    let isTimeout = err instanceof DOMException && err.name === 'TimeoutError'
    if (!isTimeout) console.error('[intent-classifier] agent error:', err)
    return { unclear: `Could not resolve intent from: "${message}"` }
  }

  let text = (result?.text ?? '').trim()
  if (!text) {
    return { unclear: `Could not resolve intent from: "${message}"` }
  }

  let parsed = parseIntentJson(text)
  if (!parsed) {
    return { unclear: text }
  }

  let intent = AGENT_ACTION_TO_INTENT[`${String(parsed.type)}:${String(parsed.action)}`]
  if (!intent) {
    return { unclear: text }
  }

  let raw = parsed.targetQuery
  let targetQuery = (typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '').trim()

  let rawResource = parsed.resourceQuery
  let resourceQuery = (
    typeof rawResource === 'string' || typeof rawResource === 'number' ? String(rawResource) : ''
  ).trim()

  if (!targetQuery && intent !== INTENTS.SHOW_APPOINTMENTS) {
    return { unclear: text }
  }
  if (intent === INTENTS.DELETE_APPOINTMENTS && !resourceQuery) {
    return { unclear: text }
  }
  return { intent, targetQuery, resourceQuery }
}
