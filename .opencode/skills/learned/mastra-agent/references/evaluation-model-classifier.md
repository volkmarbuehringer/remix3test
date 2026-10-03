# Mastra Classifier / ClassifierProcessor Against a Non-AI-SDK Provider

**Source:** `app/actions/mastra/evaluation-model.ts`, `workflow-classifier.ts`, `agents/support-agent.ts`
**Extracted:** 2026-10-03
**Context:** Using `Classifier` / `ClassifierProcessor` when the app chat model is a
custom OpenAI-compatible object rather than an AI SDK evaluation provider.

## Problem

- `Classifier`, `ClassifierProcessor` and `ModelSelectionProcessor` accept only
  `EvaluationModelV4 | MastraEvaluationModel`. A plain custom chat model is not
  one, and no `@ai-sdk` evaluation provider is installed.
- Even with an adapter, a `Classifier` answer is **choice / score / boolean only**
  — it cannot return free text, so it cannot replace a structured-output extractor.
- A `ClassifierProcessor` abort surfaces as a `tripwire` chunk that a stream
  mapper can silently drop.

## Solution

### 1. Implement `MastraEvaluationModelInterface` directly (no new dependency)

```ts
import type { MastraEvaluationModelInterface } from '@mastra/core/classifier'

export function createEvaluationModel(options = {}): MastraEvaluationModelInterface {
  return {
    specificationVersion: 'v4',
    provider: 'opencode-go',
    modelId: 'deepseek-v4.1-flash',
    supportedQuestionTypes: ['choice', 'score', 'boolean'] as const,
    async doEvaluate({ state, questions, abortSignal }) {
      let httpResponse = await doFetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { /* bearer + provider headers */ },
        body: JSON.stringify({
          model: modelId,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT }, // JSON-only instruction
            { role: 'user', content: JSON.stringify({ state, questions }) },
          ],
        }),
        ...(abortSignal ? { signal: abortSignal } : {}),
      })
      let json = (await httpResponse.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      let raw = extractAnswers(json.choices?.[0]?.message?.content ?? '')
      return { answers: normalizeAnswers(questions, raw), warnings: [], usage, response: { modelId } }
    },
  }
}
```

The system prompt asks for `{"answers":{"<questionId>": ...}}` only. Tolerate
markdown and prose by slicing the first `{` to the last `}` before `JSON.parse`.

### 2. Normalize strictly — never fabricate an answer

Choice `{type:'choice',choice}`, score `{type:'score',score}`, boolean
`{type:'boolean',probability}`.

- Missing or unrecognized answer → **throw**.
- Present but out-of-range numbers → clamp; match a choice case-insensitively.

Why: a missing boolean defaulted to `0.5` passes any threshold above 0.5, and a
garbled choice defaulted to the first criterion hides a malformed response. A
throw is visible; the caller (a `ClassifierProcessor` with `errorStrategy: 'warn'`)
still fails open where the surrounding controls are safe.

### 3. A `Classifier` cannot extract free text — pair it

```ts
let [intent, extraction] = await Promise.all([
  adminIntentClassifier.evaluate({ state: { message } }),
  extractionAgent.generate(message, {
    structuredOutput: { schema: entityExtractionSchema, jsonPromptInjection: 'system' },
  }),
])
// merge into the existing combined schema so classifyWithAgent() and every
// consumer keep their contract
```

Latency is about the slower call; token usage is roughly doubled.

### 4. Register it, then gate with a processor

```ts
new Mastra({ classifiers: { adminIntent: adminIntentClassifier } })

new ClassifierProcessor({
  id: 'admin-mutation-gate',
  classifier: adminIntentClassifier, // or 'adminIntent' by key/id
  lastMessageOnly: true,
  errorStrategy: 'warn',
  onResult: (answers, { abort }) => {
    if (blocksMutation(answers.intent.choice)) abort('...')
  },
})
```

Keep the blocked set in an exported predicate built from shared `INTENTS`
constants so a rename cannot silently widen the gate, and unit-test the predicate
(no LLM needed).

### 5. Forward the `tripwire` chunk, or the block is silent

`ClassifierProcessor` and `PromptInjectionDetector` abort with
`{ type: 'tripwire', payload: { reason, processorId } }` — **not** `type: 'error'`.
A `filterAndForward` that only maps `error` drops it, so the stream ends and the
user sees an empty reply.

```ts
} else if (type === 'tripwire') {
  fwd('message', { text: errorToText(p?.reason ?? 'Blocked by a guardrail.') })
  fwd('complete', {}) // a tripwire has no `finish` chunk, so the client never finalizes
}
```

### 6. Set `maxProcessorRetries` explicitly

Configuring `errorProcessors` without an agent-level `maxProcessorRetries` logs a
warning and applies a safety cap of `3` (up to **4 model calls per turn**). Set it
on the shared agent scaffold.

### 7. Test seam

`createEvaluationModel({ fetchImpl, apiKey, headers })` lets a hermetic test drive
a **real `Classifier`** through a mocked provider — no key, no network.

## When to Use

- A `Classifier`/`ClassifierProcessor`/`ModelSelectionProcessor` needs a model the
  app provider cannot supply.
- Considering replacing a structured-output extractor with a `Classifier` (it
  cannot carry free text — pair, don't replace).
- A guardrail works in a direct `generate()` probe but the chat reply is empty
  (check for an unforwarded `tripwire`).
- Tuning error-processor retry cost.
