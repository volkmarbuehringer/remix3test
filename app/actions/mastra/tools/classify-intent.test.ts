import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { classifyIntentTool } from './classify-intent.ts'
import { __setWorkflowAgent } from '../intent-classifier.ts'
import { MAX_MESSAGE_LENGTH } from '../../../utils/message-limits.ts'

function execTool(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  let fn = classifyIntentTool.execute as unknown as (
    input: Record<string, unknown>,
    opts: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>
  return fn(input, {})
}

describe('classify_intent tool', () => {
  it('resolves a user mutation into an intent and target', async () => {
    __setWorkflowAgent({
      generate: async () => ({
        object: { type: 'user-action', action: 'cancel', targetQuery: 'alice@example.com' },
      }),
    })
    let result = await execTool({ message: 'kündige alice@example.com' })
    assert.equal(result.resolved, true)
    assert.equal(result.intent, 'cancel-user')
    assert.equal(result.targetQuery, 'alice@example.com')
  })

  it('carries the resource query for appointment deletion', async () => {
    __setWorkflowAgent({
      generate: async () => ({
        object: {
          type: 'appointment',
          action: 'delete-resource',
          targetQuery: 'bob',
          resourceQuery: 'Raum A',
        },
      }),
    })
    let result = await execTool({ message: 'delete all appointments for bob in Raum A' })
    assert.equal(result.resolved, true)
    assert.equal(result.intent, 'delete-appointments')
    assert.equal(result.resourceQuery, 'Raum A')
  })

  it('coerces a numeric targetQuery from the structured object', async () => {
    __setWorkflowAgent({
      generate: async () => ({
        object: { type: 'user-action', action: 'lock', targetQuery: 42 },
      }),
    })
    let result = await execTool({ message: 'sperre 42' })
    assert.equal(result.resolved, true)
    assert.equal(result.intent, 'lock-user')
    assert.equal(result.targetQuery, '42')
  })

  it('accepts an admin request up to the shared message limit', () => {
    // Regression guard: the tool description tells the agent to pass the
    // admin's request verbatim, so the input cap must not be lower than the
    // composer/server limit the request was validated against.
    let schema = classifyIntentTool.inputSchema as unknown as { parse: (value: unknown) => unknown }
    let parsed = schema.parse({ message: 'x'.repeat(MAX_MESSAGE_LENGTH) }) as { message: string }
    assert.equal(parsed.message.length, MAX_MESSAGE_LENGTH)
  })

  it('reports unresolved when the classifier returns an unclear object', async () => {
    __setWorkflowAgent({
      generate: async () => ({ object: { type: 'unclear', question: 'Das verstehe ich nicht.' } }),
    })
    let result = await execTool({ message: 'hmm' })
    assert.equal(result.resolved, false)
    assert.equal(result.unclear, 'Das verstehe ich nicht.')
  })

  it('reports unresolved when the structured object does not match the schema', async () => {
    __setWorkflowAgent({ generate: async () => ({ object: { foo: 'bar' } }) })
    let result = await execTool({ message: 'hmm' })
    assert.equal(result.resolved, false)
    assert.ok(typeof result.unclear === 'string' && result.unclear.length > 0)
  })

  it('accepts null for a field the model left unset', async () => {
    // Regression: a stricter schema rejected `null` for optional fields and
    // degraded "show all appointments" (null target) to a generic unclear,
    // losing a valid request.
    __setWorkflowAgent({
      generate: async () => ({
        object: {
          type: 'appointment',
          action: 'check',
          targetQuery: null,
          period: null,
          status: null,
        },
      }),
    })
    let result = await execTool({ message: 'zeig mir alle Termine' })
    assert.equal(result.resolved, true)
    assert.equal(result.intent, 'show-appointments')
    assert.equal(result.targetQuery, '')
  })

  it('keeps the clarifying question when unused fields are null', async () => {
    __setWorkflowAgent({
      generate: async () => ({
        object: {
          type: 'unclear',
          question: 'Welchen Benutzer meinst du?',
          action: null,
          targetQuery: null,
        },
      }),
    })
    let result = await execTool({ message: 'hmm' })
    assert.equal(result.resolved, false)
    assert.equal(result.unclear, 'Welchen Benutzer meinst du?')
  })
})
