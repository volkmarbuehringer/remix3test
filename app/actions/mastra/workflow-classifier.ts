import { Agent } from '@mastra/core/agent'
import { agentModelSettings, createMemory, createModel } from './agent-config.ts'

// ── Headless intent classifier ─────────────────────────────────────
//
// This is NOT a conversational app agent: it has no tools, no UI and no
// persona, and it is deliberately kept out of the Mastra `agents` registry in
// `index.ts`. It exists only so the Agent-Events pipeline and the support
// agent's `classify_intent` tool can turn a free-text admin request into the
// structured JSON that `intent-classifier.ts` parses. Mastra's `Agent` class is
// used purely as the LLM-call primitive.

const WORKFLOW_CLASSIFIER_INSTRUCTIONS = `You are an intent resolver for an admin panel. Your job is to understand what the admin wants and return structured JSON. Return ONLY the JSON object — no markdown, no explanations, no natural language.

APPOINTMENT ACTIONS (keywords: appointment, Termin, booking, Buchung, etc.):
Two sub-actions:

1. Check appointments:
    {"type":"appointment","action":"check","targetQuery":"<user name, email, or ID or empty>","period":"<today|this-week|this-month|next-week|next-month or empty>","status":"<pending|expired or empty>"}
   Use targetQuery when the admin names a specific user. Leave empty for general queries like "show all appointments". status and period are optional.

2. Delete appointments for a user on a resource:
   {"type":"appointment","action":"delete-resource","targetQuery":"<user name, email, or ID>","resourceQuery":"<resource name>"}
   Use when the admin wants to delete all upcoming appointments for a named user on a named resource (e.g. "delete all appointments for John in Raum A").

If the admin wants to manage a user account (cancel, lock, unlock, lookup, find, disable, delete, activate, enable, sperren, kündigen, stornieren, löschen, deaktivieren, entsperren, freischalten):
{"type":"user-action","action":"<cancel|lock|unlock|lookup>","targetQuery":"<user id, name, or email from the admin's message>"}

The "action" field must ALWAYS be one of the English values cancel|lock|unlock|lookup, even when the admin writes in German. German verb → action mapping:
- kündigen, kündige, Kündigung, stornieren, Stornierung, löschen (account), delete, cancel → "cancel"
- sperren, sperre, Sperrung, blockieren, deaktivieren, disable, lock → "lock"
- entsperren, entsperre, freischalten, aktivieren, enable, unlock → "unlock"
- suchen, finden, anzeigen, show, find, lookup → "lookup"

If the admin is asking about something else or the intent is unclear, ask one clarifying question. Keep it brief. Do NOT add any text before or after the JSON.`

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

/** Runs one classification turn against the headless classifier. */
export function generateWorkflowIntent(
  message: string,
  opts?: { abortSignal?: AbortSignal },
): Promise<{ text?: string }> {
  return getClassifier().generate(message, opts ?? {})
}
