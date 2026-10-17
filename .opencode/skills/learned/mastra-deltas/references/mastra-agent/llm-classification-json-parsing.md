# Parsing LLM Classification Output Robustly

**Source:** `llm-classification-json-parsing`

**Extracted:** 2026-08-18
**Context:** Switched an admin intent-classification pipeline from keyword matching to `agent.generate()` (Mastra workflow agent). Code review surfaced three concrete LLM-output pitfalls that break classification in production despite green tests.

## Problem

When an LLM returns structured JSON for intent/action classification, naive parsing fails silently in three ways:

1. **Numeric fields where code expects strings.** LLMs commonly emit `"targetQuery": 42` (a JSON number) for an ID, but the parser checks `typeof x === 'string'` and silently emits an empty target. Downstream "resolve user" then reports "no target specified" — the primary flow breaks in production while tests pass (because the test double always emitted strings).
2. **Markdown-wrapped or noisy responses.** `JSON.parse(agent.text)` throws on markdown fences, prose around the JSON, or truncated output. You need tolerant extraction (scan for the first `{` and last `}`), not strict parsing.
3. **Unparseable/unmapped output has no safe outcome.** If the agent returns garbage or an action the pipeline can't execute, the pipeline must degrade to an explicit "unclear" state — never proceed with empty/partial data.

## Solution

A three-part pattern: tolerant extraction, explicit string coercion, and a discriminated result with a safe fallback.

```ts
// 1. Tolerant extraction — strip markdown/prose, scan braces
function parseIntentJson(text: string): Record<string, unknown> | null {
  let start = text.indexOf('{')
  let end = text.lastIndexOf('}')
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1))
    } catch { /* fall through */ }
  }
  return null
}

// 2. Numeric coercion — LLMs emit numbers for IDs
let raw = parsed.targetQuery
let targetQuery =
  (typeof raw === 'string' || typeof raw === 'number' ? String(raw) : '').trim()

// 3. Discriminated result + safe fallback — never proceed on garbage
export type ClassifyResult =
  | { intent: string; targetQuery: string }
  | { unclear: string }
```

Key discipline points:

- **Coerce, don't assert**: accept both `string` and `number` for ID-like fields, then `String()`. Asserting `typeof === 'string'` bakes in an assumption LLMs routinely violate.
- **Bound the call**: pass `abortSignal: AbortSignal.timeout(ms)` to `generate`/`stream`. `abortSignal` is a first-class documented option on Mastra `Agent.generate` — no cast needed, and the agent loop rejects on abort.
- **Safe fallback**: unparseable/unmapped output returns `{ unclear }` — and in an event pipeline, `intent.unclear` has no downstream handlers that execute actions, so garbage can never trigger a write. Actionable intents require a non-empty target; query-style intents (e.g. "show all appointments") may legitimately have an empty one.
- **Expected timeouts are not errors**: `AbortSignal.timeout` rejection is control flow, not a fault. Check `err.name === 'TimeoutError'` and skip the error-level log.

## When to Use

- Building an LLM-based intent/action classifier that returns JSON
- Parsing `agent.generate()` text into structured actions with a fallback state
- Any LLM JSON field that holds an ID or number but is typed as string
- Event/agent pipelines where unparseable model output must degrade safely (never execute on garbage)

## Superseded by structured output (when available)

As of 2026-10-02 this app runs its intent classifier with Mastra
`structuredOutput` instead of reading `agent.generate().text`, so the
tolerant-extraction half of this pattern (`parseIntentJson`) is gone. The
discipline worth keeping:

- **Make the schema tolerant, then coerce**: accept
  `z.union([z.string(), z.number(), z.null()])` for ID-like fields and normalize
  to a trimmed string in the consumer
  (`value == null ? '' : String(value).trim()`). A `.transform()` on the schema
  looks tidier but serializes the field to `{}` in the prompt-injected JSON
  schema, which drops the type guidance and invites the `null` you then have to
  handle.
- **Give "unclear" a schema slot** (`type: 'unclear'` + a `question` field)
  instead of relying on prose the parser cannot read. Make the field
  `.nullable()`: a model filling unused fields with `null` otherwise fails
  validation and loses the clarifying question.
- **Keep the discriminated `{ unclear }` fallback**: a schema mismatch or a
  thrown provider error must still degrade safely, never execute.
- **Force `jsonPromptInjection: 'system'`** for providers missing from Mastra's
  capability registry. Verified by smoke test (2026-10-02): `'auto'` resolves to
  native `response_format: { type: 'json_schema' }` even for a custom
  OpenAI-compatible gateway, with no schema in the prompt — so a provider that
  rejects `json_schema` degrades *every* classification to `unclear`. Injection
  is provider-agnostic and the response is still schema-validated; use `'auto'`
  only after confirming native support against the real provider.
