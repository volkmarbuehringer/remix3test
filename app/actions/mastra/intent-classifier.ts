import { AGENT_TIMEOUT_MS } from './shared-agent.ts'
import { INTENTS } from '../agent-events/intents.ts'
import { generateWorkflowIntent, intentClassificationSchema } from './workflow-classifier.ts'

export type ClassifyAgent = {
  generate: (message: string, opts?: { abortSignal?: AbortSignal }) => Promise<{ object?: unknown }>
}

// ── Workflow (intent) classifier resolution ────────────────────────

let _workflowClassifier: ClassifyAgent | undefined
let _workflowClassifierReady = false

/** Test seam: inject (or clear) the classifier used by every caller. */
export function __setWorkflowAgent(agent: ClassifyAgent | undefined): void {
  _workflowClassifier = agent
  _workflowClassifierReady = true
}

/**
 * Resolves the headless intent classifier.
 *
 * The classifier is a utility, not a registered Mastra agent: it has no tools,
 * no UI and no persona, so there is no `mastra.getAgent(...)` lookup. Both the
 * Agent-Events classify handler and the support agent's `classify_intent` tool
 * resolve it here, so they cannot drift.
 */
export async function resolveWorkflowAgent(): Promise<ClassifyAgent> {
  if (_workflowClassifierReady) {
    if (!_workflowClassifier) throw new Error('No classify agent configured')
    return _workflowClassifier
  }
  _workflowClassifier = {
    generate: (message, opts) => generateWorkflowIntent(message, opts),
  }
  _workflowClassifierReady = true
  return _workflowClassifier
}

type ClassifyResult =
  | {
      intent: string
      targetQuery: string
      resourceQuery?: string | undefined
      period?: string | undefined
      status?: string | undefined
    }
  | { unclear: string }

const AGENT_ACTION_TO_INTENT: Record<string, string> = {
  'user-action:cancel': INTENTS.CANCEL_USER,
  'user-action:lock': INTENTS.LOCK_USER,
  'user-action:unlock': INTENTS.UNLOCK_USER,
  'user-action:lookup': INTENTS.LOOKUP_USER,
  'appointment:check': INTENTS.SHOW_APPOINTMENTS,
  'appointment:delete-resource': INTENTS.DELETE_APPOINTMENTS,
}

/**
 * Normalizes an optional ID-like field. The model may return a string, a bare
 * number ("user 42"), or `null` for a field it left unset; all three must map
 * to a trimmed string so a valid request never degrades to `unclear`.
 */
function toQueryText(value: string | number | null | undefined): string {
  return value == null ? '' : String(value).trim()
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

  // `structuredOutput` already validated the object, so this guard only catches
  // an injected test double or a provider that ignored the schema. It keeps the
  // "never execute on garbage" property without slicing model prose.
  let parsed = intentClassificationSchema.safeParse(result?.object)
  if (!parsed.success) {
    return { unclear: `Could not resolve intent from: "${message}"` }
  }
  let classification = parsed.data

  if (classification.type === 'unclear') {
    return {
      unclear:
        classification.question?.trim() || `Could not resolve intent from: "${message}"`,
    }
  }

  let intent = AGENT_ACTION_TO_INTENT[`${classification.type}:${classification.action}`]
  if (!intent) {
    return { unclear: `Could not resolve intent from: "${message}"` }
  }

  let targetQuery = toQueryText(classification.targetQuery)
  let resourceQuery = toQueryText(classification.resourceQuery)

  if (!targetQuery && intent !== INTENTS.SHOW_APPOINTMENTS) {
    return { unclear: `Could not resolve intent from: "${message}"` }
  }
  if (intent === INTENTS.DELETE_APPOINTMENTS && !resourceQuery) {
    return { unclear: `Could not resolve intent from: "${message}"` }
  }

  let period = toQueryText(classification.period) || undefined
  let status = toQueryText(classification.status) || undefined

  return {
    intent,
    targetQuery,
    ...(resourceQuery ? { resourceQuery } : {}),
    ...(period ? { period } : {}),
    ...(status ? { status } : {}),
  }
}
