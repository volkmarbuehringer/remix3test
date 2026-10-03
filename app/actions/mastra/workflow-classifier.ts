import { Agent } from '@mastra/core/agent'
import { Classifier } from '@mastra/core/classifier'
import { z } from 'zod/v4'
import { agentModelSettings, createModel } from './agent-config.ts'
import { createEvaluationModel } from './evaluation-model.ts'

// ── Headless admin intent classification ───────────────────────────
//
// Two primitives cooperate here:
//
// 1. `adminIntentClassifier` — a registered Mastra `Classifier` backed by the
//    evaluation model (`evaluation-model.ts`). It returns one typed, validated
//    choice for the action.
// 2. A narrowed extraction `Agent` with `structuredOutput` that fills the
//    free-text fields the classifier cannot: `targetQuery`, `resourceQuery`,
//    `period`, `status` and a clarifying `question`.
//
// A `Classifier` answer is choice/score/boolean only, so the free-text half
// cannot move into it. Both run concurrently and are merged into
// `intentClassificationSchema`, so `classifyWithAgent()` and every consumer
// (the Agent-Events pipeline and the support agent's `classify_intent` tool)
// keep the exact same contract. Wall-clock latency stays close to the previous
// single call; token usage is higher.

/**
 * The combined contract consumed by `classifyWithAgent()`.
 *
 * ID-like fields accept `string | number | null`: models emit a bare number for
 * "user 42" and fill unused fields with `null`. Coercion to a trimmed string
 * lives in `classifyWithAgent()`, not in a `.transform()` here, because an
 * applied transform serializes to `{}` in the schema the model is shown.
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

/** The free-text subset the extraction agent fills. */
const entityExtractionSchema = z.object({
  targetQuery: queryField.optional(),
  resourceQuery: queryField.optional(),
  period: queryField.optional(),
  status: queryField.optional(),
  question: z.string().nullable().optional(),
})

/**
 * Maps the classifier's typed choice onto the combined schema's `type`/`action`
 * pair, which `classifyWithAgent()` maps on to an intent id. Absent or unknown
 * choices are treated as `unclear`.
 */
const INTENT_CHOICE_TO_TYPE_ACTION: Record<
  string,
  { type: 'user-action' | 'appointment'; action: string } | null
> = {
  'cancel-user': { type: 'user-action', action: 'cancel' },
  'lock-user': { type: 'user-action', action: 'lock' },
  'unlock-user': { type: 'user-action', action: 'unlock' },
  'lookup-user': { type: 'user-action', action: 'lookup' },
  'show-appointments': { type: 'appointment', action: 'check' },
  'delete-appointments': { type: 'appointment', action: 'delete-resource' },
}

/**
 * The typed intent decision. Registered on the `Mastra` instance under
 * `classifiers.adminIntent` so it is also reachable as a workflow step
 * (`.classifier('adminIntent')`) and through `getClassifierById()`.
 *
 * The criteria carry German synonyms because the admin surface is
 * German-speaking: the model must map verbs such as `kündigen` or `freischalten`
 * onto the English option without a separate glossary. `unclear` stays first as
 * the safe default, though the evaluation adapter now throws on an unrecognized
 * answer rather than silently returning it.
 */
export const adminIntentClassifier = new Classifier({
  id: 'admin-intent',
  model: createEvaluationModel(),
  questions: {
    intent: {
      type: 'choice',
      instructions:
        "Which action does the admin request? Choose 'unclear' unless the request clearly matches one of the other options.",
      criteria: {
        unclear: 'anything else, or the request is ambiguous',
        'cancel-user': 'cancel or delete a user account (kündigen, stornieren, löschen)',
        'lock-user': 'lock, block or disable a user account (sperren, blockieren, deaktivieren)',
        'unlock-user':
          'unlock, enable or re-activate a user account (entsperren, freischalten, aktivieren)',
        'lookup-user': 'look up or find a user (suchen, finden, anzeigen)',
        'show-appointments': "show or list a user's appointments (Termine anzeigen)",
        'delete-appointments':
          'delete all upcoming appointments for a named user on a named resource (Termine löschen)',
      },
    },
  },
})

const EXTRACTION_INSTRUCTIONS = `You extract target entities from an admin's request in an appointment-management system.

The action itself is decided elsewhere, so do NOT classify the action. Extract only:
- targetQuery: the user the request refers to (id, name or email), or null.
- resourceQuery: the resource (room or treatment) named in the request, or null.
- period: a date-range hint (today, this-week, this-month, next-week, next-month), or null.
- status: a status hint (pending, expired), or null.
- question: one short clarifying question ONLY when no user can be identified; otherwise null.

Fill unused fields with null. Never invent a user, resource or date the message does not contain.`

let _extractionAgent: Agent | undefined

function getExtractionAgent(): Agent {
  if (!_extractionAgent) {
    _extractionAgent = new Agent({
      id: 'admin-entity-extractor',
      name: 'Admin Entity Extractor',
      instructions: EXTRACTION_INSTRUCTIONS,
      model: createModel(),
      defaultOptions: { modelSettings: agentModelSettings },
      tools: {},
    })
  }
  return _extractionAgent
}

// ── Test seams ─────────────────────────────────────────────────────

type ClassifyIntentFn = (
  message: string,
  opts?: { abortSignal?: AbortSignal },
) => Promise<{ choice: string }>

type ExtractEntitiesFn = (
  message: string,
  opts?: { abortSignal?: AbortSignal },
) => Promise<{ object?: unknown }>

let _classifyIntent: ClassifyIntentFn | undefined
let _extractEntities: ExtractEntitiesFn | undefined

/** Test seam: replaces the typed intent classifier call. */
export function __setIntentClassifier(fn: ClassifyIntentFn | undefined): void {
  _classifyIntent = fn
}

/** Test seam: replaces the entity extraction call. */
export function __setEntityExtractor(fn: ExtractEntitiesFn | undefined): void {
  _extractEntities = fn
}

async function classifyIntent(
  message: string,
  opts?: { abortSignal?: AbortSignal },
): Promise<{ choice: string }> {
  let result = await adminIntentClassifier.evaluate({
    state: { message },
    ...(opts?.abortSignal ? { abortSignal: opts.abortSignal } : {}),
  })
  return { choice: result.answers.intent.choice }
}

/**
 * `jsonPromptInjection: 'system'` embeds the schema in the system prompt rather
 * than relying on the provider's native `response_format`. This custom
 * OpenAI-compatible gateway is absent from Mastra's capability registry, and
 * `'auto'` resolves to native `json_schema` for it — a mode the upstream model
 * may reject, which would degrade *every* extraction instead of failing loudly.
 */
async function extractEntities(
  message: string,
  opts?: { abortSignal?: AbortSignal },
): Promise<{ object?: unknown }> {
  return getExtractionAgent().generate(message, {
    ...(opts?.abortSignal ? { abortSignal: opts.abortSignal } : {}),
    structuredOutput: { schema: entityExtractionSchema, jsonPromptInjection: 'system' },
  })
}

/**
 * Classifies one admin request into the combined schema.
 *
 * The typed intent and the entity extraction run concurrently. A classifier
 * failure or an unparseable extraction degrades that half to its safe default
 * (unclear / empty entities) rather than throwing.
 */
export async function generateWorkflowIntent(
  message: string,
  opts?: { abortSignal?: AbortSignal },
): Promise<{ object?: unknown }> {
  let [intent, extraction] = await Promise.all([
    (_classifyIntent ?? classifyIntent)(message, opts),
    (_extractEntities ?? extractEntities)(message, opts),
  ])

  let mapped = INTENT_CHOICE_TO_TYPE_ACTION[intent.choice] ?? null
  let parsed = entityExtractionSchema.safeParse(extraction?.object)
  let entity = parsed.success ? parsed.data : {}

  return {
    object: {
      type: mapped ? mapped.type : 'unclear',
      action: mapped ? mapped.action : null,
      targetQuery: entity.targetQuery ?? null,
      resourceQuery: entity.resourceQuery ?? null,
      period: entity.period ?? null,
      status: entity.status ?? null,
      question: entity.question ?? null,
    },
  }
}
