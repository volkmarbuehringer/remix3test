import { Agent } from '@mastra/core/agent'
import { z } from 'zod/v4'
import { agentModelSettings, createMemory, createModel } from './agent-config.ts'

// ── Headless intent classifier ─────────────────────────────────────
//
// This is NOT a conversational app agent: it has no tools, no UI and no
// persona, and it is deliberately kept out of the Mastra `agents` registry in
// `index.ts`. It exists only so the Agent-Events pipeline and the support
// agent's `classify_intent` tool can turn a free-text admin request into the
// structured JSON that `intent-classifier.ts` consumes. Mastra's `Agent` class
// is used purely as the LLM-call primitive.

/**
 * Output contract for the classifier.
 *
 * The classifier runs with `structuredOutput`, so this schema — not brace
 * slicing of model prose — defines the result. ID-like fields accept
 * `string | number | null`: models emit a bare number for "user 42" and fill
 * unused optional fields with `null`, and either value would fail a stricter
 * schema and degrade a valid request to `unclear`.
 *
 * Coercion to a trimmed string lives in `classifyWithAgent()`, **not** in a
 * `.transform()` here: an applied transform serializes to `{}` in the schema
 * the model is shown, so it drops the type information and invites exactly the
 * `null` this schema now has to tolerate.
 *
 * `type: 'unclear'` gives the model a place to ask a clarifying question
 * instead of inventing an intent.
 */
const queryField = z.union([z.string(), z.number(), z.null()])

export const intentClassificationSchema = z.object({
  type: z.enum(['user-action', 'appointment', 'unclear']),
  action: z
    .enum(['check', 'delete-resource', 'cancel', 'lock', 'unlock', 'lookup'])
    .nullable()
    .optional(),
  targetQuery: queryField.optional(),
  resourceQuery: queryField.optional(),
  period: queryField.optional(),
  status: queryField.optional(),
  question: z.string().nullable().optional(),
})

export type IntentClassification = z.infer<typeof intentClassificationSchema>

const WORKFLOW_CLASSIFIER_INSTRUCTIONS = `You are an intent resolver for an admin panel. Read the admin's request and fill the required structured-output fields from it.

APPOINTMENT requests (keywords: appointment, Termin, booking, Buchung):
- action "check" for lookup/list requests. Include targetQuery when the admin names a specific user, and period/status when the message references a date range (today, this-week, this-month, next-week, next-month) or a status (pending, expired).
- action "delete-resource" when the admin wants to delete all upcoming appointments for a named user on a named resource. Include targetQuery (the user) and resourceQuery (the resource).

USER ACCOUNT requests (cancel, lock, unlock, lookup, find, disable, delete, activate, enable, sperren, kündigen, stornieren, löschen, deaktivieren, entsperren, freischalten):
- type "user-action". The action is ALWAYS one of the English values cancel|lock|unlock|lookup, even when the admin writes in German.
- German verb -> action mapping:
  - kündigen, kündige, Kündigung, stornieren, Stornierung, löschen (account), delete, cancel -> "cancel"
  - sperren, sperre, Sperrung, blockieren, deaktivieren, disable, lock -> "lock"
  - entsperren, entsperre, freischalten, aktivieren, enable, unlock -> "unlock"
  - suchen, finden, anzeigen, show, find, lookup -> "lookup"
- targetQuery is the user id, name, or email named in the message.

If the request does not map to any of the above, set type "unclear" and put one brief clarifying question in "question". Never invent an intent.`

let _classifier: Agent | undefined

function getClassifier(): Agent {
  if (!_classifier) {
    _classifier = new Agent({
      id: 'workflow-classifier',
      name: 'Workflow Intent Classifier',
      instructions: WORKFLOW_CLASSIFIER_INSTRUCTIONS,
      model: createModel(),
      defaultOptions: { modelSettings: agentModelSettings },
      tools: {},
      memory: createMemory({ lastMessages: 10 }),
    })
  }
  return _classifier
}

/**
 * Runs one classification turn against the headless classifier.
 *
 * `jsonPromptInjection: 'system'` embeds the schema in the system prompt rather
 * than relying on the provider's native `response_format`. This provider is a
 * custom OpenAI-compatible gateway (`opencode-go`) absent from Mastra's
 * capability registry, and `'auto'` resolves to native `json_schema` for it —
 * a mode the upstream model may reject. A rejected request degrades *every*
 * classification to `unclear` instead of failing loudly, so injection (which
 * works with any chat model) is the safer default. The response is still
 * validated against the schema; flip to `'auto'` only after confirming native
 * support against the real provider.
 */
export function generateWorkflowIntent(
  message: string,
  opts?: { abortSignal?: AbortSignal },
): Promise<{ object?: unknown }> {
  return getClassifier().generate(message, {
    ...opts,
    structuredOutput: {
      schema: intentClassificationSchema,
      jsonPromptInjection: 'system',
    },
  })
}
