import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { supportAgent } from '../agents/support-agent.ts'
import { customerAgent } from '../agents/customer-agent.ts'
import { EVAL_JOURNEYS } from './journeys.ts'

// Gate names are the agent's runtime tool keys, not `createTool({ id })` values.
// A renamed or removed tool would otherwise make `checks.calledTool(name)`
// score 0 forever — the gate would never pass, but nothing would explain why.
// This runs without an LLM key, so it protects the live gate in CI.
const AGENTS = { supportAgent, customerAgent } as const

describe('eval gate definitions', () => {
  it('uses unique journey ids', () => {
    let ids = EVAL_JOURNEYS.map((journey) => journey.id)
    assert.equal(new Set(ids).size, ids.length, `duplicate journey ids: ${ids.join(', ')}`)
  })

  it('gates only on tools the target agent actually exposes', async () => {
    let toolsByAgent = new Map<string, Set<string>>()
    for (let [name, agent] of Object.entries(AGENTS)) {
      toolsByAgent.set(name, new Set(Object.keys(await agent.listTools())))
    }

    for (let journey of EVAL_JOURNEYS) {
      let runtimeNames = toolsByAgent.get(journey.agent)
      assert.ok(runtimeNames, `journey ${journey.id} targets unknown agent "${journey.agent}"`)
      let gated = [...journey.mustCall, ...(journey.mustNotCall ?? [])]
      assert.ok(gated.length > 0, `journey ${journey.id} has no gates`)
      for (let name of gated) {
        assert.ok(
          runtimeNames.has(name),
          `journey ${journey.id} gates on "${name}", which is not a ${journey.agent} tool key (have: ${[...runtimeNames].join(', ')})`,
        )
      }
    }
  })

  it('gives request-context agents an actor', () => {
    for (let journey of EVAL_JOURNEYS) {
      if (journey.agent === 'customerAgent') {
        assert.ok(
          journey.actorId !== undefined,
          `journey ${journey.id} targets the customer agent but sets no actorId`,
        )
      }
    }
  })
})
