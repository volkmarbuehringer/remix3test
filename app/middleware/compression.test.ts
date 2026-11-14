import { gunzipSync } from 'node:zlib'

import { before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../test-router.ts'
import { routes } from '../routes.ts'
import { initializeAppDatabase } from '../db.ts'

const BASE = 'https://remix.run'

// The unit test next door covers compressResponse() in isolation; this one
// proves the app's middleware stack actually installs compression() and that a
// real response is gzip-encoded (not merely marked `Vary`). The exact
// Accept-Encoding spelling in Vary is the Safari-relevant contract.
describe('compression middleware', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('compresses a real HTML response and includes Accept-Encoding in Vary', async () => {
    let response = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      headers: { 'Accept-Encoding': 'gzip' },
    })

    assert.equal(response.status, 200)
    assert.equal(response.headers.get('Content-Encoding'), 'gzip')
    let vary = response.headers.get('Vary') ?? ''
    assert.ok(
      vary.split(',').some((name) => name.trim() === 'Accept-Encoding'),
      `expected Vary to include Accept-Encoding, got ${JSON.stringify(vary)}`,
    )

    let html = gunzipSync(new Uint8Array(await response.arrayBuffer())).toString('utf8')
    assert.ok(html.includes('<html'), 'the decompressed body should be the login document')
  })
})
