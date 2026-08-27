import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

const { assetServer } = await import('./assets.ts')

describe('asset server inspection', () => {
  it('serves the reachable entry surface', async () => {
    let details = await assetServer.getAssetDetails('/assets/app/routes.ts')
    assert.equal(details.status, 'reachable')
    assert.equal(details.url, '/assets/app/routes.ts')
    assert.ok(details.filePath?.endsWith('app/routes.ts'))
  })

  it('denies app test source via the denyFiles rule', async () => {
    let details = await assetServer.getAssetDetails('/assets/app/ui/agent-events-log.test.ts')
    assert.equal(details.status, 'denied')
    assert.equal(details.access?.deniedBy, 'app/**/*.test.*')
  })

  it('lists reachable assets without app test source', async () => {
    let assets = await assetServer.getAssets()
    assert.ok(assets.some((asset) => asset.url === '/assets/app/routes.ts'))

    // denyFiles is scoped to app/**; the node_modules/*path mapping legitimately
    // exposes package internals (e.g. @remix-run/test's own framework.test.* files).
    let appAssets = assets.filter((asset) => asset.url!.startsWith('/assets/app/'))
    assert.ok(appAssets.length > 0)
    assert.ok(appAssets.every((asset) => !asset.url!.includes('.test.')))
  })
})
