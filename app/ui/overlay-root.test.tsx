import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { renderToString } from 'remix/component/server'

import { OverlayPortal } from './overlay-root.tsx'

describe('OverlayPortal server rendering', () => {
  it('renders nothing on the server', async () => {
    let html = await renderToString(
      <OverlayPortal>
        <p data-overlay-content>Server content</p>
      </OverlayPortal>,
    )

    assert.equal(html, '', 'a portal without a browser destination emits no markup')
  })
})
