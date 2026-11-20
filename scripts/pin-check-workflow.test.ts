import * as fs from 'node:fs'
import * as path from 'node:path'

import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

// Preview tarballs are pruned after ~30 days. This workflow is the only
// scheduled check; keep it network-only (no install, no database, no browser)
// and keep it non-strict, because --strict also fails when a newer main preview
// exists, which is true most days.

const ROOT = path.resolve(import.meta.dirname, '..')
const WORKFLOW = fs.readFileSync(path.join(ROOT, '.github/workflows/pin-check.yml'), 'utf8')

describe('pin-check workflow', () => {
  it('runs daily and on manual dispatch', () => {
    assert.match(WORKFLOW, /^ {2}schedule:/m)
    assert.match(WORKFLOW, /^\s+- cron: ['"]17 4 \* \* \*['"]/m)
    assert.match(WORKFLOW, /^ {2}workflow_dispatch:/m)
  })

  it('runs the pin check without --strict', () => {
    assert.match(WORKFLOW, /run: node \.\/scripts\/check-remix-pin\.ts/)
    assert.ok(!WORKFLOW.includes('--strict'), '--strict fails whenever a newer preview exists')
  })

  it('stays network-only: no install, database, or browser setup', () => {
    assert.ok(!WORKFLOW.includes('pnpm install'), 'pin check does not need dependencies')
    assert.ok(!WORKFLOW.includes('services:'), 'pin check does not need Postgres')
    assert.ok(!WORKFLOW.includes('playwright'), 'pin check does not need browsers')
  })
})
