import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { PasswordReveal } from './password-reveal.browser.tsx'

// ---------------------------------------------------------------------------
// PasswordReveal — the eye button in the admin users edit/create panels.
//
// Unlike the document-wide PasswordToggle script, this is a client entry, so
// the click handler belongs to the rendered button. Frame-swapped admin panels
// hydrate it normally (inline <script> tags in frame fragments do not run).
// ---------------------------------------------------------------------------

let cleanup: (() => void) | null = null

afterEach(() => {
  cleanup?.()
  cleanup = null
})

function mount(fieldName = 'password') {
  let result = render(
    <form>
      <input type="password" name="password" />
      <PasswordReveal fieldName={fieldName} />
    </form>,
  )
  cleanup = result.cleanup
  return {
    result,
    input: result.$('input') as HTMLInputElement,
    button: result.$('button') as HTMLButtonElement,
  }
}

describe('PasswordReveal', () => {
  it('reveals and re-masks the matching password field', async () => {
    let { result, input, button } = mount()
    assert.equal(input.type, 'password', 'sanity: masked initially')
    assert.equal(button.getAttribute('aria-label'), 'Passwort anzeigen')

    await result.act(() => button.click())

    assert.equal(input.type, 'text', 'first click reveals')
    assert.equal(button.getAttribute('aria-label'), 'Passwort ausblenden')

    await result.act(() => button.click())

    assert.equal(input.type, 'password', 'second click masks again')
    assert.equal(button.getAttribute('aria-label'), 'Passwort anzeigen')
  })

  it('leaves a differently named password field untouched', async () => {
    let { result, input, button } = mount('confirmPassword')

    await result.act(() => button.click())

    assert.equal(input.type, 'password', 'only the configured field is revealed')
  })
})
