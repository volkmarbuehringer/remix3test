import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { blocksMutation, MUTATING_INTENTS } from './support-agent.ts'
import { INTENTS } from '../../agent-events/intents.ts'

// The mutation gate is the only hard read-only boundary on the admin agent, and
// its policy is plain data. Locking the predicate here means a future edit that
// drops an intent fails a keyless test instead of silently widening the gate.
describe('support agent mutation gate policy', () => {
  it('blocks every state-changing intent', () => {
    for (let intent of [
      INTENTS.CANCEL_USER,
      INTENTS.LOCK_USER,
      INTENTS.UNLOCK_USER,
      INTENTS.DELETE_APPOINTMENTS,
    ]) {
      assert.equal(blocksMutation(intent), true, `should block ${intent}`)
    }
  })

  it('passes read-only and unclear intents', () => {
    for (let intent of [INTENTS.LOOKUP_USER, INTENTS.SHOW_APPOINTMENTS, 'unclear', '']) {
      assert.equal(blocksMutation(intent), false, `should pass ${intent}`)
    }
  })

  it('keeps the blocked set to exactly the state-changing intents', () => {
    assert.deepEqual(
      [...MUTATING_INTENTS].sort(),
      [
        INTENTS.CANCEL_USER,
        INTENTS.LOCK_USER,
        INTENTS.UNLOCK_USER,
        INTENTS.DELETE_APPOINTMENTS,
      ].sort(),
    )
  })
})
