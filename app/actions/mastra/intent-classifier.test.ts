import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { resolveWorkflowAgent } from './intent-classifier.ts'

describe('intent-classifier resolution', () => {
  it('resolves the headless classifier when no test seam is installed', async () => {
    // No __setWorkflowAgent() call here: this exercises the lazy construction
    // branch, which every injected-fake test bypasses. A broken classifier
    // module or a constructor that throws fails here instead of only in prod.
    let agent = await resolveWorkflowAgent()
    assert.equal(typeof agent.generate, 'function')
  })
})
