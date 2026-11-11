import { before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../test-router.ts'
import { routes } from '../routes.ts'
import { initializeAppDatabase } from '../db.ts'

const BASE = 'https://remix.run'

// The unit test next door covers compressResponse() in isolation; this one
// proves the app's middleware stack actually installs compression() and that a
// real response carries the Vary contract Safari relies on (the exact
// Accept-Encoding spelling plus any existing Vary names).
describe('compression middleware', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('includes Accept-Encoding in Vary on a real response', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    assert.equal(response.status, 200)
    let vary = response.headers.get('Vary') ?? ''
    assert.ok(
      vary.split(',').some((name) => name.trim() === 'Accept-Encoding'),
      `expected Vary to include Accept-Encoding, got ${JSON.stringify(vary)}`,
    )
  })
})
