import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

// The full suite in ci.yml is manual (Postgres + Playwright, ~30 min).
// preflight.yml is the cheap guard that catches lint/type regressions on every
// push; keep it running exactly those checks, without database/browser setup.

const ROOT = path.resolve(import.meta.dirname, '..')
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github/workflows/preflight.yml'), 'utf8')

describe('preflight workflow', () => {
  it('runs on every push and pull request', () => {
    assert.match(WORKFLOW, /^on:\n {2}push:\n {2}pull_request:/m)
  })

  it('runs the cheap checks', () => {
    for (let command of ['pnpm typecheck', 'pnpm lint', 'pnpm format']) {
      assert.ok(WORKFLOW.includes(`- run: ${command}`), `preflight must run ${command}`)
    }
  })

  it('stays cheap: no database service and no Playwright browsers', () => {
    assert.ok(!WORKFLOW.includes('services:'), 'preflight must not start Postgres')
    assert.ok(!WORKFLOW.includes('playwright'), 'preflight must not install browsers')
  })
})
