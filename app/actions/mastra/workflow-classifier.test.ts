import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import {
  __setEntityExtractor,
  __setIntentClassifier,
  adminIntentClassifier,
  generateWorkflowIntent,
  intentClassificationSchema,
} from './workflow-classifier.ts'

afterEach(() => {
  __setIntentClassifier(undefined)
  __setEntityExtractor(undefined)
})

async function classify(message: string, choice: string, object: unknown) {
  __setIntentClassifier(async () => ({ choice }))
  __setEntityExtractor(async () => ({ object }))
  let result = await generateWorkflowIntent(message)
  return intentClassificationSchema.parse(result.object)
}

describe('generateWorkflowIntent (hybrid merge)', () => {
  it('maps a typed classifier choice plus extracted entities onto the combined schema', async () => {
    let parsed = await classify('cancel john doe', 'cancel-user', { targetQuery: 'john doe' })
    assert.deepEqual(parsed, {
      type: 'user-action',
      action: 'cancel',
      targetQuery: 'john doe',
      resourceQuery: null,
      period: null,
      status: null,
      question: null,
    })
  })

  it('maps a delete-appointments choice with a resource', async () => {
    let parsed = await classify(
      'delete appointments for user@newapp.com on raum 1',
      'delete-appointments',
      {
        targetQuery: 'user@newapp.com',
        resourceQuery: 'raum 1',
      },
    )
    assert.equal(parsed.type, 'appointment')
    assert.equal(parsed.action, 'delete-resource')
    assert.equal(parsed.targetQuery, 'user@newapp.com')
    assert.equal(parsed.resourceQuery, 'raum 1')
  })

  it('degrades an unclear or unknown choice to type unclear', async () => {
    let parsed = await classify('what is the weather', 'unclear', {})
    assert.equal(parsed.type, 'unclear')
    assert.equal(parsed.action, null)
  })

  it('defaults entities to null when extraction returns nothing parseable', async () => {
    let parsed = await classify('lock max', 'lock-user', { nope: true })
    assert.equal(parsed.type, 'user-action')
    assert.equal(parsed.action, 'lock')
    assert.equal(parsed.targetQuery, null)
  })
})

describe('adminIntentClassifier questions', () => {
  it('keeps the German verbs the admin surface uses', () => {
    let criteria = adminIntentClassifier.questions.intent.criteria
    assert.match(String(criteria['cancel-user'] ?? ''), /kündigen/)
    assert.match(String(criteria['lock-user'] ?? ''), /sperren/)
    assert.match(String(criteria['unlock-user'] ?? ''), /freischalten/)
    assert.match(String(criteria['lookup-user'] ?? ''), /suchen/)
  })
})
