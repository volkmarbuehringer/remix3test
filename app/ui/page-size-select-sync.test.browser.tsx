import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { PageSizeSelectSync } from './page-size-select-sync.browser.tsx'

const FIXTURE_HTML = `
  <form action="/settings" method="POST" id="settings-form">
    <select name="pageSize" data-page-size-select="true">
      <option value="5">5</option>
      <option value="10">10</option>
      <option value="50" selected>50</option>
    </select>
    <input type="number" name="pageSizeCustom" data-page-size-custom="true" value="" />
  </form>
  <form action="/other" method="POST" id="other-form">
    <select name="pageSize" id="other-select" data-page-size-select="true">
      <option value="5">5</option>
      <option value="50" selected>50</option>
    </select>
    <input type="number" name="other" value="37" />
  </form>
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

function selectOf(host: HTMLElement, selector = '[data-page-size-select]'): HTMLSelectElement {
  return host.querySelector(selector) as HTMLSelectElement
}

function inputOf(host: HTMLElement, selector = '[data-page-size-custom]'): HTMLInputElement {
  return host.querySelector(selector) as HTMLInputElement
}

function change(select: HTMLSelectElement, value: string): void {
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

async function mountEntry(): Promise<void> {
  let result = render(<PageSizeSelectSync />)
  cleanup = result.cleanup
  await result.act(() => {})
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('PageSizeSelectSync', () => {
  it('mirrors a changed preset into the custom input', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)
    let inputs = 0
    input.addEventListener('input', () => inputs++)

    change(selectOf(host), '10')

    assert.equal(input.value, '10')
    assert.equal(inputs, 1, 'the mirror should emit an input event')
  })

  it('prefills an empty custom input from the current preset on focus', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)

    input.focus()

    assert.equal(input.value, '50', 'focus starts fine-tuning from the selected preset')
  })

  it('does not overwrite a typed value on focus', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)
    input.value = '37'

    input.focus()

    assert.equal(input.value, '37', 'focus must not clobber a custom value')
  })

  it('lets a newly chosen preset win over a typed value', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)
    input.value = '37'

    change(selectOf(host), '10')

    assert.equal(input.value, '10', 'the select is an explicit coarse choice')
  })

  it('only mirrors its own form', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)
    let other = host.querySelector('input[name="other"]') as HTMLInputElement

    change(selectOf(host, '#other-select'), '5')

    assert.equal(input.value, '', 'the other form must not touch this control')
    assert.equal(other.value, '37', 'the other form keeps its own value')
  })

  it('ignores selects that are not page-size controls', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)
    let select = selectOf(host)
    select.removeAttribute('data-page-size-select')

    change(select, '10')

    assert.equal(input.value, '')
  })

  it('refills after the user clears the custom input', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)

    input.focus()
    input.value = ''
    input.blur()
    input.focus()

    assert.equal(input.value, '50')
  })
})
