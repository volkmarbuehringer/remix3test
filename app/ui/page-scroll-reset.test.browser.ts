import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { isManualScrollReset } from './page-scroll-reset.browser.tsx'

// ---------------------------------------------------------------------------
// The app resets its nested page/grid scrollers after a same-document
// navigation (guide 06 §"Navigate a frame with a form": the scroll controls
// accept "manual" / "after-transition", with "true"/"false" as compatibility
// aliases). The runtime reads the attribute from the form's submitter first and
// from the form second; the app's own reset must mirror that lookup or a
// `data-rmx-reset-scroll="manual"` on a form would be ignored whenever a submit
// button initiated the navigation.
// ---------------------------------------------------------------------------

describe('isManualScrollReset', () => {
  it('honours a link attribute', () => {
    let link = document.createElement('a')
    assert.equal(isManualScrollReset(link), false)
    link.setAttribute('data-rmx-reset-scroll', 'manual')
    assert.equal(isManualScrollReset(link), true)
    link.setAttribute('data-rmx-reset-scroll', 'false')
    assert.equal(isManualScrollReset(link), true)
    link.setAttribute('data-rmx-reset-scroll', 'true')
    assert.equal(isManualScrollReset(link), false)
    link.setAttribute('data-rmx-reset-scroll', 'after-transition')
    assert.equal(isManualScrollReset(link), false)
  })

  it('falls back from a submitter to its form', () => {
    let form = document.createElement('form')
    let button = document.createElement('button')
    button.type = 'submit'
    form.append(button)
    document.body.append(form)

    assert.equal(isManualScrollReset(button), false)
    form.setAttribute('data-rmx-reset-scroll', 'manual')
    assert.equal(isManualScrollReset(button), true, 'the form attribute applies to its submitter')

    button.setAttribute('data-rmx-reset-scroll', 'after-transition')
    assert.equal(
      isManualScrollReset(button),
      false,
      'the submitter attribute wins over the form attribute',
    )

    form.remove()
  })

  it('does not inherit a form attribute for an unrelated control', () => {
    let form = document.createElement('form')
    form.setAttribute('data-rmx-reset-scroll', 'manual')
    let link = document.createElement('a')
    form.append(link)
    document.body.append(form)

    assert.equal(isManualScrollReset(link), false, 'only form submitters inherit the form value')
    form.remove()
  })

  it('treats a missing source as the default reset', () => {
    assert.equal(isManualScrollReset(null), false)
    assert.equal(isManualScrollReset(undefined), false)
  })
})
