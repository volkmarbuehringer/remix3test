import { runEvals } from '@mastra/core/evals'
import { checks } from '@mastra/evals/checks'
import type { Agent } from '@mastra/core/agent'
import { mastra } from '../index.ts'
import { createActorRequestContext } from '../actor-context.ts'
import { EVAL_JOURNEYS, type EvalJourney } from './journeys.ts'

function agentFor(journey: EvalJourney): Agent {
  return mastra.getAgent(journey.agent) as unknown as Agent
}

/**
 * A journey's gates: every required tool call, every forbidden one, and a
 * blanket "no tool threw". Gate-only runs are supported by `runEvals`, so no
 * quality scorer threshold is needed for a hard pass/fail signal.
 */
export function gatesFor(journey: EvalJourney) {
  return [
    ...journey.mustCall.map((tool) => checks.calledTool(tool)),
    ...(journey.mustNotCall ?? []).map((tool) => checks.didNotCall(tool)),
    checks.noToolErrors(),
  ]
}

export interface JourneyResult {
  journey: EvalJourney
  verdict: string | undefined
  gateResults: Array<{ id: string; passed: boolean; averageScore?: number }>
}

/** Runs one journey's gates against its agent through `runEvals`. */
export async function runJourney(journey: EvalJourney): Promise<JourneyResult> {
  let result = await runEvals({
    data: [
      {
        input: journey.input,
        // The customer tools read the authenticated actor from the request
        // context; `runEvals` forwards this per item to the target run.
        ...(journey.actorId !== undefined
          ? { requestContext: createActorRequestContext(journey.actorId) }
          : {}),
      },
    ],
    target: agentFor(journey),
    gates: gatesFor(journey),
  })
  return {
    journey,
    verdict: result.verdict,
    gateResults: (result.gateResults ?? []) as JourneyResult['gateResults'],
  }
}

/** Runs every journey sequentially so a shared DB is not hit concurrently. */
export async function runAllJourneys(): Promise<JourneyResult[]> {
  let results: JourneyResult[] = []
  for (let journey of EVAL_JOURNEYS) {
    results.push(await runJourney(journey))
  }
  return results
}

/** A journey fails only when the verdict is an explicit `failed`. */
export function failedJourneys(results: JourneyResult[]): JourneyResult[] {
  return results.filter((r) => r.verdict === 'failed')
}
