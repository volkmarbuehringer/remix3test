import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { Classifier } from '@mastra/core/classifier'
import { createEvaluationModel } from './evaluation-model.ts'

function chatResponse(
  content: string,
  usage = { prompt_tokens: 11, completion_tokens: 7 },
): Response {
  return new Response(
    JSON.stringify({ id: 'chatcmpl-test', usage, choices: [{ message: { content } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

describe('createEvaluationModel', () => {
  it('answers a configured Classifier and satisfies its validation', async () => {
    let captured: { url: string; init: RequestInit } | undefined
    let fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init: init ?? {} }
      return chatResponse(
        'Here you go: ' +
          JSON.stringify({
            answers: {
              intent: { type: 'choice', choice: 'cancel' },
              urgent: { type: 'boolean', probability: 0.9 },
            },
          }) +
          ' — done.',
      )
    }) as unknown as typeof fetch

    let classifier = new Classifier({
      id: 'test-classifier',
      model: createEvaluationModel({
        apiKey: () => 'test-key',
        headers: () => ({ 'X-Opencode-Session': 'session-test' }),
        fetchImpl,
      }),
      questions: {
        intent: {
          type: 'choice',
          instructions: 'What does the admin want?',
          criteria: { unclear: 'anything else', cancel: 'cancel a user' },
        },
        urgent: { type: 'boolean', instructions: 'Is it urgent?' },
      },
    })

    let result = await classifier.evaluate({ state: { message: 'Sperre den Benutzer' } })

    assert.equal(result.answers.intent.choice, 'cancel')
    assert.equal(result.answers.urgent.probability, 0.9)
    assert.equal(result.usage.totalTokens, 18)

    assert.ok(captured, 'should call the provider')
    let call = captured!
    assert.match(call.url, /\/chat\/completions$/)
    let headers = call.init.headers as Record<string, string>
    assert.equal(headers.Authorization, 'Bearer test-key')
    assert.equal(headers['X-Opencode-Session'], 'session-test')
    let body = JSON.parse(String(call.init.body)) as {
      messages: Array<{ role: string; content: string }>
    }
    assert.match(body.messages[0]!.content, /evaluation model/)
    assert.match(body.messages[1]!.content, /Sperre den Benutzer/)
  })

  it('rejects an unknown choice instead of silently defaulting', async () => {
    let fetchImpl = (async () =>
      chatResponse(
        JSON.stringify({
          answers: {
            intent: { type: 'choice', choice: 'nonsense' },
            urgent: { type: 'boolean', probability: 0.5 },
          },
        }),
      )) as unknown as typeof fetch
    let classifier = new Classifier({
      id: 'unknown-choice-classifier',
      model: createEvaluationModel({ apiKey: () => 'k', headers: () => ({}), fetchImpl }),
      questions: {
        intent: {
          type: 'choice',
          instructions: 'intent?',
          criteria: { unclear: 'not sure', cancel: 'cancel' },
        },
        urgent: { type: 'boolean' },
      },
    })

    await assert.rejects(() => classifier.evaluate({ state: 'hi' }), /unknown option/)
  })

  it('rejects a missing answer instead of fabricating one', async () => {
    let fetchImpl = (async () =>
      chatResponse(
        JSON.stringify({ answers: { urgent: { type: 'boolean', probability: 0.5 } } }),
      )) as unknown as typeof fetch
    let classifier = new Classifier({
      id: 'missing-answer-classifier',
      model: createEvaluationModel({ apiKey: () => 'k', headers: () => ({}), fetchImpl }),
      questions: {
        intent: {
          type: 'choice',
          instructions: 'intent?',
          criteria: { unclear: 'not sure', cancel: 'cancel' },
        },
      },
    })

    await assert.rejects(() => classifier.evaluate({ state: 'hi' }), /no answer for question/)
  })

  it('clamps present out-of-range numbers', async () => {
    let fetchImpl = (async () =>
      chatResponse(
        JSON.stringify({
          answers: {
            score: { type: 'score', score: 9 },
            flag: { type: 'boolean', probability: 2 },
          },
        }),
      )) as unknown as typeof fetch
    let classifier = new Classifier({
      id: 'clamp-classifier',
      model: createEvaluationModel({ apiKey: () => 'k', headers: () => ({}), fetchImpl }),
      questions: {
        score: { type: 'score', instructions: 'rate the answer', criteria: ['a', 'b', 'c'] },
        flag: { type: 'boolean', instructions: 'is it flagged?' },
      },
    })

    let result = await classifier.evaluate({ state: 'hi' })
    assert.equal(result.answers.score.score, 2)
    assert.equal(result.answers.flag.probability, 1)
  })

  it('throws on a non-OK provider response', async () => {
    let fetchImpl = (async () => new Response('boom', { status: 500 })) as unknown as typeof fetch
    let model = createEvaluationModel({ apiKey: () => 'k', headers: () => ({}), fetchImpl })
    await assert.rejects(
      () =>
        model.doEvaluate({
          state: 'x',
          questions: { q: { type: 'boolean', instructions: 'y' } },
        }),
      /evaluation model request failed \(500\)/,
    )
  })
})
