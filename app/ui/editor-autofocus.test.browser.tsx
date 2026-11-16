import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'

import { EditorAutofocus } from './editor-autofocus.browser.tsx'

// ---------------------------------------------------------------------------
// EditorAutofocus — focus the first field when an inline editor opens.
//
// The editor opens through a frame navigation, where the autofocus attribute
// never runs, so the entry focuses the first marked field on hydration. The
// second half is the important regression guard: a validation-error re-render
// must NOT be treated like a fresh editor, or the first field would steal focus
// back from the rejected control / form-level error banner that FormErrorFocus
// just focused.
// ---------------------------------------------------------------------------

let fixture: HTMLElement | null = null
let result: RenderResult | null = null

afterEach(() => {
  result?.cleanup()
  result = null
  fixture?.remove()
  fixture = null
})

function mount(html: string): HTMLFormElement {
  let host = document.createElement('div')
  // The entry resolves its form via closest(), so its mount point must live
  // inside the form it is supposed to focus.
  host.innerHTML = html.replace('</form>', '<div id="autofocus-mount"></div></form>')
  document.body.appendChild(host)
  fixture = host
  return host.querySelector('form') as HTMLFormElement
}

async function renderEntry(form: HTMLFormElement): Promise<void> {
  result = render(<EditorAutofocus />, {
    container: form.querySelector('#autofocus-mount') as HTMLElement,
  })
  await result.act(() => undefined)
}

describe('EditorAutofocus', () => {
  it('focuses the first marked field of a fresh editor', async () => {
    let form = mount(
      '<form><input id="second" /><input id="primary" data-editor-autofocus-field /></form>',
    )
    await renderEntry(form)

    assert.equal(
      document.activeElement?.id,
      'primary',
      'the marked field must receive focus when the editor opens',
    )
  })

  it('leaves focus on the invalid field of a validation-error re-render', async () => {
    let form = mount(
      '<form><input id="primary" data-editor-autofocus-field /><select id="resource" aria-invalid="true"></select></form>',
    )
    let invalid = form.querySelector('#resource') as HTMLSelectElement
    invalid.focus()

    await renderEntry(form)

    assert.equal(
      document.activeElement,
      invalid,
      'a re-render with an invalid field must not move focus to the first field',
    )
  })

  it('leaves focus on the form-level error banner', async () => {
    let form = mount(
      '<form><input id="primary" data-editor-autofocus-field /><div id="banner" data-form-error tabindex="-1"></div></form>',
    )
    let banner = form.querySelector('#banner') as HTMLElement
    banner.focus()

    await renderEntry(form)

    assert.equal(document.activeElement, banner, 'the error banner keeps focus')
  })
})
