import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { supportAgent } from '../agents/support-agent.ts'
import { EVAL_JOURNEYS } from './journeys.ts'

// Gate names are the agent's runtime tool keys, not `createTool({ id })` values.
// A renamed or removed tool would otherwise make `checks.calledTool(name)`
// score 0 forever — the gate would never pass, but nothing would explain why.
// This runs without an LLM key, so it protects the live gate in CI.
describe('eval gate definitions', () => {
  it('uses unique journey ids', () => {
    let ids = EVAL_JOURNEYS.map((journey) => journey.id)
    assert.equal(new Set(ids).size, ids.length, `duplicate journey ids: ${ids.join(', ')}`)
  })

  it('gates only on tools the target agent actually exposes', async () => {
    let tools = await supportAgent.listTools()
    let runtimeNames = new Set(Object.keys(tools))

    for (let journey of EVAL_JOURNEYS) {
      let gated = [...journey.mustCall, ...(journey.mustNotCall ?? [])]
      assert.ok(gated.length > 0, `journey ${journey.id} has no gates`)
      for (let name of gated) {
        assert.ok(
          runtimeNames.has(name),
          `journey ${journey.id} gates on "${name}", which is not a support-agent tool key (have: ${[...runtimeNames].join(', ')})`,
        )
      }
    }
  })
})
