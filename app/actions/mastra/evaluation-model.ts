import type { MastraEvaluationModelInterface } from '@mastra/core/classifier'
import { OPENCODE_API_URL } from '../../utils/ai-provider.ts'
import {
  OPENCODE_MODEL_ID,
  OPENCODE_PROVIDER_ID,
  opencodeRequestHeaders,
  requireOpenCodeApiKey,
} from './model-config.ts'

// ── Evaluation model (Mastra Classifier / processor backend) ───────
//
// Mastra's `Classifier`, `ClassifierProcessor` and `ModelSelectionProcessor`
// need an `EvaluationModelV4`: an object that answers typed questions
// (choice / score / boolean) about a piece of state. The app's custom
// `opencode-go` model is a plain chat model, so it cannot satisfy that contract,
// and no AI SDK evaluation provider is installed. This adapter bridges the gap:
// it prompts the chat model with the questions and normalizes the reply into the
// answer shapes Mastra validates.
//
// Evaluation prompts are short and structured, so temperature 0 is used.

type EvaluationModelResult = Awaited<ReturnType<MastraEvaluationModelInterface['doEvaluate']>>
type ProviderQuestions = Parameters<MastraEvaluationModelInterface['doEvaluate']>[0]['questions']

type NormalizedAnswer =
  | { type: 'choice'; choice: string }
  | { type: 'score'; score: number }
  | { type: 'boolean'; probability: number }

const SYSTEM_PROMPT = `You are a precise evaluation model. You receive a JSON object with a "state" to judge and "questions" to answer.

Return exactly one answer per question id:
- "choice": pick exactly one option name from the question's "criteria" keys.
- "score": return a number in [0, criteria.length - 1], where 0 is the first criterion.
- "boolean": return the probability that the statement is true, a number in [0, 1].

Respond with ONLY a JSON object in this shape, with no prose and no markdown:
{"answers":{"<questionId>":{"type":"choice","choice":"<option>"},"<questionId>":{"type":"score","score":0},"<questionId>":{"type":"boolean","probability":0.5}}}

Rules:
- Include exactly one entry for every question id.
- The answer "type" must match the question "type".
- Judge only from the supplied state. Do not invent facts.`

interface EvaluationModelOptions {
  modelId?: string
  providerId?: string
  baseUrl?: string
  apiKey?: () => string
  headers?: () => Record<string, string>
  /** Test seam: replaces the network call. */
  fetchImpl?: typeof fetch
}

export function createEvaluationModel(
  options: EvaluationModelOptions = {},
): MastraEvaluationModelInterface {
  let modelId = options.modelId ?? OPENCODE_MODEL_ID
  let providerId = options.providerId ?? OPENCODE_PROVIDER_ID
  let baseUrl = (options.baseUrl ?? OPENCODE_API_URL).replace(/\/+$/, '')
  let getApiKey = options.apiKey ?? requireOpenCodeApiKey
  let getHeaders = options.headers ?? opencodeRequestHeaders
  let doFetch = options.fetchImpl ?? fetch

  return {
    specificationVersion: 'v4',
    provider: providerId,
    modelId,
    supportedQuestionTypes: ['choice', 'score', 'boolean'] as const,
    async doEvaluate({ state, questions, abortSignal }) {
      let response = await doFetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getApiKey()}`,
          ...getHeaders(),
        },
        body: JSON.stringify({
          model: modelId,
          temperature: 0,
          stream: false,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: JSON.stringify({ state, questions }) },
          ],
        }),
        ...(abortSignal ? { signal: abortSignal } : {}),
      })

      if (!response.ok) {
        let body = await response.text().catch(() => '')
        throw new Error(
          `evaluation model request failed (${response.status}): ${body.slice(0, 300)}`,
        )
      }

      let json = (await response.json()) as {
        id?: string
        usage?: { prompt_tokens?: number; completion_tokens?: number }
        choices?: Array<{ message?: { content?: string } }>
      }
      let raw = extractAnswers(json.choices?.[0]?.message?.content ?? '')

      return {
        answers: normalizeAnswers(questions, raw),
        warnings: [],
        usage: {
          ...(typeof json.usage?.prompt_tokens === 'number'
            ? { inputTokens: json.usage.prompt_tokens }
            : {}),
          ...(typeof json.usage?.completion_tokens === 'number'
            ? { outputTokens: json.usage.completion_tokens }
            : {}),
        },
        response: {
          ...(json.id ? { id: json.id } : {}),
          timestamp: new Date(),
          modelId,
          body: json,
        },
      } satisfies EvaluationModelResult
    },
  }
}

/**
 * Pulls the first JSON object out of a chat reply, tolerating markdown fences
 * and surrounding prose. If the object carries an `answers` key, that is the
 * answer map; otherwise the whole object is treated as the map.
 */
function extractAnswers(content: string): Record<string, unknown> {
  let start = content.indexOf('{')
  let end = content.lastIndexOf('}')
  if (start === -1 || end <= start) {
    throw new Error('evaluation model returned no JSON object')
  }
  let parsed = JSON.parse(content.slice(start, end + 1)) as Record<string, unknown>
  let answers = parsed.answers
  return answers && typeof answers === 'object' ? (answers as Record<string, unknown>) : parsed
}

/**
 * Coerces the model's answers into the exact shapes Mastra validates.
 *
 * A missing or unrecognized answer throws instead of being fabricated. Silent
 * defaults hide a malformed model response behind a plausible value: a missing
 * boolean probability becomes 0.5 (passing any threshold above 0.5), and a
 * garbled choice becomes the first criterion. Present but out-of-range numbers
 * (a score past the last level, a probability above 1) are clamped, and a choice
 * is matched case-insensitively.
 */
function normalizeAnswers(
  questions: ProviderQuestions,
  raw: Record<string, unknown>,
): Record<string, NormalizedAnswer> {
  let answers: Record<string, NormalizedAnswer> = {}
  for (let [id, question] of Object.entries(questions)) {
    let candidate = raw[id]
    if (!candidate || typeof candidate !== 'object') {
      throw new Error(`evaluation model returned no answer for question '${id}'`)
    }
    let answer = candidate as Record<string, unknown>
    if (question.type === 'choice') {
      let choices = Object.keys(question.criteria)
      let rawChoice = typeof answer.choice === 'string' ? answer.choice : ''
      let choice =
        choices.find((option) => option === rawChoice) ??
        choices.find((option) => option.toLowerCase() === rawChoice.toLowerCase())
      if (!choice) {
        throw new Error(
          `evaluation model answer '${id}' selected unknown option '${rawChoice}' (expected one of: ${choices.join(', ')})`,
        )
      }
      answers[id] = { type: 'choice', choice }
    } else if (question.type === 'score') {
      let score = Number(answer.score)
      if (!Number.isFinite(score)) {
        throw new Error(`evaluation model answer '${id}' returned a non-numeric score`)
      }
      let max = question.criteria.length - 1
      answers[id] = { type: 'score', score: Math.min(Math.max(score, 0), max) }
    } else {
      let probability = Number(answer.probability)
      if (!Number.isFinite(probability)) {
        throw new Error(`evaluation model answer '${id}' returned a non-numeric probability`)
      }
      answers[id] = { type: 'boolean', probability: Math.min(Math.max(probability, 0), 1) }
    }
  }
  return answers
}
