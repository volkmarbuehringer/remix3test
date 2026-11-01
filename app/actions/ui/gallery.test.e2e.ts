import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createTestServer } from 'remix/node-fetch-server/test'

import { router } from '../../test-router.ts'
import { isFirefox } from '../../../test/utils.ts'

// ---------------------------------------------------------------------------
// Gallery hydration: the demo page wraps the default export in a client entry
// and the demo itself nests another clientEntry. This is the smallest check
// that the gallery's asset URL + import map actually hydrate a demo, not just
// server-render it.
//
// Firefox still renders the demo, but the pinned remix-ui runtime does not fire
// the delegated click handler (the same known incompatibility documented in
// app/actions/scroll-restoration/scroll-restoration.test.e2e.ts). Keep Firefox
// as a render smoke check and run the interaction on Chromium only.
// ---------------------------------------------------------------------------

describe('UI gallery hydration', () => {
  it('hydrates the nested counter client entry', async (t) => {
    let server = await createTestServer((request) => router.fetch(request))
    let page = await t.serve(server)

    await page.goto('/ui/demo/theme/counter.demo.tsx')

    let button = page.getByRole('button', { name: 'Geklickt: 0' })
    await button.waitFor()

    if (isFirefox(page)) {
      assert.ok(await button.isVisible(), 'Firefox should render the hydrated demo')
      return
    }

    await button.click()

    let updated = page.getByRole('button', { name: 'Geklickt: 1' })
    await updated.waitFor()
    assert.ok(await updated.isVisible(), 'the hydrated counter should update after a click')
  })
})
