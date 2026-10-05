import { runAllJourneys, failedJourneys } from '../app/actions/mastra/evals/gates.ts'

// Live evals call the real model; fail fast and loudly rather than reporting a
// green run when the credential is simply absent.
if (!process.env.OPENCODE_API_KEY) {
  console.error('OPENCODE_API_KEY is required to run the live Mastra evals.')
  process.exit(2)
}

const results = await runAllJourneys()
for (let result of results) {
  let label = result.verdict === 'failed' ? 'FAIL' : 'ok  '
  console.log(`${label} ${result.journey.id} (${result.verdict ?? 'no-verdict'})`)
  for (let gate of result.gateResults) {
    console.log(`      ${gate.passed ? 'pass' : 'FAIL'} ${gate.id}`)
  }
}

const failed = failedJourneys(results)
if (failed.length > 0) {
  console.error(
    `\n${failed.length} journey gate(s) failed: ${failed.map((f) => f.journey.id).join(', ')}`,
  )
  process.exit(1)
}
console.log(`\nAll ${results.length} journey gates passed.`)

// The Mastra storage pool keeps sockets open, so the process would otherwise
// hang here after reporting success (verified: a pooled pg query without an
// explicit exit does not terminate). Exit explicitly so the CI step completes.
process.exit(0)
