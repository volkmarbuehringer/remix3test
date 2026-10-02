import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { supportAgent } from './agents/support-agent.ts'

// The admin agent's guardrails are configuration, not behavior, so the useful
// regression test is that each lane stays wired after a refactor: without this,
// dropping `inputProcessors` is silent (defineAppAgent forwards it only when
// present) and the admin agent quietly loses injection/cost protection.
describe('support agent guardrails', () => {
  it('keeps input, output and error processors configured', async () => {
    let inputIds = (await supportAgent.listConfiguredInputProcessors()).map((p) => p.id)
    for (let id of [
      'unicode-normalizer',
      'regex-filter',
      'prompt-injection-detector',
      'token-limiter',
      'token-cost-control',
    ]) {
      assert.ok(
        inputIds.includes(id),
        `expected input processor "${id}", got: ${inputIds.join(', ')}`,
      )
    }

    let outputIds = (await supportAgent.listConfiguredOutputProcessors()).map((p) => p.id)
    assert.ok(
      outputIds.includes('regex-filter'),
      `expected output regex-filter, got: ${outputIds.join(', ')}`,
    )

    let errorIds = await supportAgent.getConfiguredErrorProcessorIds()
    assert.ok(
      errorIds.includes('stream-error-retry-processor'),
      `expected error retry processor, got: ${errorIds.join(', ')}`,
    )
  })
})
