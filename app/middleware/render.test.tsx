import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { pathToFileURL } from 'node:url'

import { resolveClientEntry } from './render.tsx'

// ---------------------------------------------------------------------------
// resolveClientEntry — client entry preload resolution
// ---------------------------------------------------------------------------

describe('resolveClientEntry', () => {
  it('returns href and exportName alongside preload hrefs', async () => {
    let entryId = pathToFileURL(
      '/home/lucky/remix3test/app/actions/client/public/grid-refresh-button.tsx',
    ).href

    let resolved = await resolveClientEntry(entryId, { name: 'GridRefreshButton' } as never)

    assert.ok(resolved.href.startsWith('/assets/'), 'should resolve a script href')
    assert.ok(Array.isArray(resolved.preloads), 'should return preloads array')
    assert.ok(resolved.preloads.length > 0, 'should include preload hrefs')
    assert.ok(
      resolved.preloads.includes(resolved.href),
      'preloads should include the entry href itself',
    )
    assert.equal(resolved.exportName, 'GridRefreshButton', 'should fall back to component name')
  })

  it('throws for non file:// entry IDs', async () => {
    try {
      await resolveClientEntry('/island.ts#Island', { name: 'Island' } as never)
      assert.fail('Expected error to be thrown')
    } catch (error) {
      assert.ok(error instanceof Error, 'should throw an Error')
      assert.ok(
        (error as Error).message.includes('Expected `import.meta.url` for clientEntry ID'),
        'should mention import.meta.url',
      )
    }
  })
})
