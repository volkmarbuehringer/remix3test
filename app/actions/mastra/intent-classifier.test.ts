import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { resolveWorkflowAgent } from './intent-classifier.ts'

describe('intent-classifier workflow agent resolution', () => {
  it('resolves the registered workflow agent when no test seam is installed', async () => {
    // No __setWorkflowAgent() call here: this exercises the lazy registry branch
    // (dynamic import of the Mastra registry plus getAgent('workflowAgent')),
    // which every injected-fake test bypasses. A wrong import path or a missing
    // registration fails here instead of only in production.
    let agent = await resolveWorkflowAgent()
    assert.equal(typeof agent.generate, 'function')
  })
})
