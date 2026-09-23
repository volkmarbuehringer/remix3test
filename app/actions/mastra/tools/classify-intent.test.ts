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
        text: '{"type":"user-action","action":"cancel","targetQuery":"alice@example.com"}',
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
        text: '{"type":"appointment","action":"delete-resource","targetQuery":"bob","resourceQuery":"Raum A"}',
      }),
    })
    let result = await execTool({ message: 'delete all appointments for bob in Raum A' })
    assert.equal(result.resolved, true)
    assert.equal(result.intent, 'delete-appointments')
    assert.equal(result.resourceQuery, 'Raum A')
  })

  it('accepts an admin request up to the shared message limit', () => {
    // Regression guard: the tool description tells the agent to pass the
    // admin's request verbatim, so the input cap must not be lower than the
    // composer/server limit the request was validated against.
    let schema = classifyIntentTool.inputSchema as unknown as { parse: (value: unknown) => unknown }
    let parsed = schema.parse({ message: 'x'.repeat(MAX_MESSAGE_LENGTH) }) as { message: string }
    assert.equal(parsed.message.length, MAX_MESSAGE_LENGTH)
  })

  it('reports unresolved when the classifier cannot parse an intent', async () => {
    __setWorkflowAgent({ generate: async () => ({ text: 'Das verstehe ich nicht.' }) })
    let result = await execTool({ message: 'hmm' })
    assert.equal(result.resolved, false)
    assert.ok(typeof result.unclear === 'string' && result.unclear.length > 0)
  })
})
