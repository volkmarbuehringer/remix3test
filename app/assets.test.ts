import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { assetServer } from './assets.ts'
import { router } from './test-router.ts'

const BASE = 'https://remix.run'

describe('asset server conditional requests', () => {
  it('matches a strong If-None-Match validator against the weak asset ETag', async () => {
    let entry = await assetServer.getScriptEntry('app/assets/entry.tsx')
    let url = `${BASE}${entry.href}`

    let first = await router.fetch(url)
    assert.equal(first.status, 200, 'asset should be served')
    let etag = first.headers.get('ETag')
    assert.ok(etag, 'asset server should emit an ETag')
    assert.ok(etag.startsWith('W/"'), 'asset server should emit a weak ETag')

    let strongTag = etag.slice(2)
    let revalidated = await router.fetch(url, {
      headers: { 'If-None-Match': strongTag },
    })

    assert.equal(revalidated.status, 304, 'strong validator should match the weak ETag')
    assert.equal(revalidated.headers.get('ETag'), etag, '304 should echo the asset ETag')
  })
})
