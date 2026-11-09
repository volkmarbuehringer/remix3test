import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { PageSizeCustomKeys } from './page-size-custom-keys.browser.tsx'

const PRESETS = [5, 10, 15, 25, 50, 100]
const MIN = 5
const MAX = 100

const FIXTURE_HTML = `
  <form action="/settings" method="POST">
    <input
      type="number"
      name="pageSizeCustom"
      data-page-size-custom="true"
      min="5"
      max="100"
      step="1"
      value="37"
    />
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

function inputOf(host: HTMLElement, selector = '[data-page-size-custom]'): HTMLInputElement {
  return host.querySelector(selector) as HTMLInputElement
}

function press(input: HTMLInputElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  let event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  })
  input.dispatchEvent(event)
  return event
}

async function mountEntry(): Promise<void> {
  let result = render(<PageSizeCustomKeys presets={PRESETS} min={MIN} max={MAX} />)
  cleanup = result.cleanup
  await result.act(() => {})
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('PageSizeCustomKeys', () => {
  it('PageUp jumps to the next preset above the current value', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)

    let event = press(input, 'PageUp')

    assert.equal(input.value, '50', '37 -> 50')
    assert.ok(event.defaultPrevented, 'the page must not scroll instead')
  })

  it('PageDown jumps to the previous preset below the current value', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)
    input.value = '50'

    press(input, 'PageDown')

    assert.equal(input.value, '25', '50 -> 25')
  })

  it('PageUp from a preset goes to the next preset', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)
    input.value = '25'

    press(input, 'PageUp')

    assert.equal(input.value, '50')
  })

  it('Home and End jump to the bounds', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)

    press(input, 'Home')
    assert.equal(input.value, String(MIN))

    press(input, 'End')
    assert.equal(input.value, String(MAX))
  })

  it('clamps at the bounds and does not emit an input event when unchanged', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)
    let inputs = 0
    input.addEventListener('input', () => inputs++)

    input.value = String(MAX)
    let up = press(input, 'PageUp')
    assert.equal(input.value, String(MAX))
    assert.ok(up.defaultPrevented)

    input.value = String(MIN)
    let down = press(input, 'PageDown')
    assert.equal(input.value, String(MIN))
    assert.ok(down.defaultPrevented)

    assert.equal(inputs, 0, 'no value change, no input event')
  })

  it('emits an input event after changing the value', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)
    let inputs = 0
    input.addEventListener('input', () => inputs++)

    press(input, 'PageUp')

    assert.equal(inputs, 1)
  })

  it('ignores inputs outside the page-size control', async () => {
    let host = mount()
    await mountEntry()
    let other = inputOf(host, 'input[name="other"]')

    let event = press(other, 'PageUp')

    assert.equal(other.value, '37', 'unrelated input must keep its value')
    assert.ok(!event.defaultPrevented, 'unrelated input must keep native behavior')
  })

  it('ignores arrow keys so native fine stepping still applies', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)

    let event = press(input, 'ArrowUp')

    assert.equal(input.value, '37', 'synthetic keydown does not emulate native stepping')
    assert.ok(!event.defaultPrevented, 'the handler must not intercept arrows')
  })

  it('ignores modified key combinations', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)

    let event = press(input, 'PageUp', { ctrlKey: true })

    assert.equal(input.value, '37')
    assert.ok(!event.defaultPrevented)
  })

  it('treats a blank value as the lower bound', async () => {
    let host = mount()
    await mountEntry()
    let input = inputOf(host)
    input.value = ''

    press(input, 'PageUp')

    assert.equal(input.value, String(MIN))
  })
})
