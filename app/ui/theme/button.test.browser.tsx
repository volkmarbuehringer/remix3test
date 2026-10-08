import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import button, { buttonLink } from './button.ts'

// ---------------------------------------------------------------------------
// The vendored button mixin must keep the upstream default: a native <button>
// host with no explicit `type` renders as type="button", never an implicit
// submit. The #11948 vendoring kept only the CSS descriptors and dropped that
// attribute mixin, which turned untyped styled buttons inside forms into
// submitters — the root cause of the appointments filter regression. Anchors
// styled with buttonLink() are unaffected (the mixin is a no-op off <button>).
// ---------------------------------------------------------------------------

describe('button mixin default attributes', () => {
  let cleanup: (() => void) | undefined

  afterEach(() => {
    cleanup?.()
    cleanup = undefined
  })

  it('defaults a native button to type="button", preserves explicit types, and leaves anchors alone', async () => {
    cleanup = render(
      <div>
        <button id="default" mix={[button()]}>
          Default
        </button>
        <button id="explicit" type="submit" mix={[button()]}>
          Explicit
        </button>
        <a id="link" href="#" mix={buttonLink()}>
          Link
        </a>
      </div>,
    ).cleanup

    // Let the mixin runtime apply the host attributes before reading them.
    await new Promise((resolve) => setTimeout(resolve, 0))

    let defaultButton = document.querySelector<HTMLButtonElement>('#default')
    let explicitButton = document.querySelector<HTMLButtonElement>('#explicit')
    let link = document.querySelector<HTMLAnchorElement>('#link')

    assert.ok(defaultButton, 'default button rendered')
    assert.ok(explicitButton, 'explicit button rendered')
    assert.ok(link, 'link rendered')

    assert.equal(
      defaultButton.type,
      'button',
      'an untyped native button must default to type="button", not submit',
    )
    assert.equal(explicitButton.type, 'submit', 'an explicit type must be preserved')
    assert.equal(link.tagName, 'A', 'buttonLink must keep the anchor host')
    assert.equal(link.getAttribute('type'), null, 'the anchor must not receive a type attribute')
  })
})
