import * as path from 'node:path'

import { expectedPnpmVersion, findPnpmPinMismatches } from './pnpm-pin.ts'

// Dependency-free guard for the pnpm pins outside package.json. Runs before
// install in CI/preflight so drift fails in seconds instead of in the full
// test suite, where `scripts/ci-pnpm-version.test.ts` also covers it.

const ROOT = path.resolve(import.meta.dirname, '..')

const mismatches = findPnpmPinMismatches(ROOT)
if (mismatches.length > 0) {
  let expected = expectedPnpmVersion(ROOT)
  console.error(`pnpm pins must match package.json packageManager (pnpm@${expected}):`)
  for (let { file, actual } of mismatches) {
    console.error(`  ${file}: ${actual ?? 'missing explicit pnpm version'}`)
  }
  console.error('Run: npm run update:deps (it syncs these pins) or update them by hand.')
  process.exitCode = 1
} else {
  console.log(`ok      pnpm pins match package.json (pnpm@${expectedPnpmVersion(ROOT)})`)
}
