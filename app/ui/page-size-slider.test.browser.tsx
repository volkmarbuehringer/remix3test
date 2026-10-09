import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { PageSizeSlider } from './page-size-slider.browser.tsx'

// The server contract (a range named `pageSize` wrapped in
// [data-page-size-control] with a [data-page-size-output]) is asserted by the
// settings server test; this test covers the client mirroring.

const FIXTURE_HTML = `
  <form action="/settings" method="POST">
    <span data-page-size-control="true">
      <input type="range" name="pageSize" min="5" max="100" value="15" data-page-size-range="true" />
      <output data-page-size-output="true">15</output>
    </span>
  </form>
  <input type="range" name="other" value="1" />
`

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mount(html = FIXTURE_HTML): HTMLElement {
  let host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  fixture = host
  return host
}

function rangeOf(host: HTMLElement, name: string): HTMLInputElement {
  return host.querySelector(`input[name="${name}"]`) as HTMLInputElement
}

function outputOf(host: HTMLElement): HTMLOutputElement | null {
  return host.querySelector('[data-page-size-output]')
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('PageSizeSlider', () => {
  it('mirrors the range value into the output on input', async () => {
    let host = mount()
    let result = render(<PageSizeSlider />)
    cleanup = result.cleanup
    await result.act(() => {})

    let range = rangeOf(host, 'pageSize')
    range.value = '37'
    range.dispatchEvent(new Event('input', { bubbles: true }))

    assert.equal(outputOf(host)?.textContent, '37')
  })

  it('ignores a range outside the page-size control', async () => {
    let host = mount()
    let result = render(<PageSizeSlider />)
    cleanup = result.cleanup
    await result.act(() => {})

    let other = rangeOf(host, 'other')
    other.value = '9'
    other.dispatchEvent(new Event('input', { bubbles: true }))

    assert.equal(outputOf(host)?.textContent, '15', 'output keeps the server value')
  })
})
