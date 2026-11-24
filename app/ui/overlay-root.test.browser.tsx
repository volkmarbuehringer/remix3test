import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { APP_OVERLAY_ROOT_ID, OverlayPortal, getAppOverlayRoot } from './overlay-root.tsx'

const CONTENT = '[data-overlay-content]'

function mountShellRoot(): HTMLDivElement {
  let root = document.createElement('div')
  root.id = APP_OVERLAY_ROOT_ID
  document.body.append(root)
  return root
}

afterEach(() => {
  document.getElementById(APP_OVERLAY_ROOT_ID)?.remove()
  document.querySelectorAll(CONTENT).forEach((node) => node.remove())
})

describe('OverlayPortal', () => {
  it('portals children into the shell overlay root, not the source tree', (t) => {
    let root = mountShellRoot()
    t.after(() => root.remove())
    assert.equal(getAppOverlayRoot(), root, 'the helper resolves the shell destination')

    let { container, cleanup } = render(
      <OverlayPortal>
        <p data-overlay-content>Overlay content</p>
      </OverlayPortal>,
    )
    t.after(cleanup)

    let content = root.querySelector(CONTENT)
    assert.ok(content, 'content must land in the overlay root')
    assert.equal(content.parentElement, root, 'the overlay root is the destination')
    assert.equal(container.querySelector(CONTENT), null, 'the source tree stays empty')

    cleanup()
    assert.equal(root.querySelector(CONTENT), null, 'disposing the portal removes its content')
  })

  it('falls back to document.body when the shell root is absent', (t) => {
    let { container, cleanup } = render(
      <OverlayPortal>
        <p data-overlay-content>Fallback content</p>
      </OverlayPortal>,
    )
    t.after(cleanup)

    assert.equal(document.getElementById(APP_OVERLAY_ROOT_ID), null)
    let content = document.body.querySelector(CONTENT)
    assert.ok(content, 'content must still render without the shell root')
    assert.equal(content.parentElement, document.body)
    assert.equal(container.querySelector(CONTENT), null)
  })
})
