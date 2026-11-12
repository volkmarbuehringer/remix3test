import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'

import { PageSizeCustomKeys } from './page-size-custom-keys.browser.tsx'
import { PageSizeSelectSync } from './page-size-select-sync.browser.tsx'

// ---------------------------------------------------------------------------
// The Settings display tab mounts both page-size entries together.
//
// Moved from settings-page-size-keys.test.e2e.ts: the failure mode is the
// client entries' combined keyboard/select behavior, not a server round trip.
// The fixture mirrors the production ids and selectors from
// app/actions/settings/controller.tsx (PageSizeSelect + PageSizeCustomInput).
// The native ArrowUp fine-step is the browser's own number-input behavior; the
// entry contract asserted here is that it does not intercept ArrowUp/ArrowDown.
// ---------------------------------------------------------------------------

const PRESETS = [5, 10, 15, 25, 50, 100]
const MIN = 5
const MAX = 100

const FIXTURE_HTML = `
  <form action="/settings" method="POST">
    <input type="hidden" name="_action" value="set-page-size" />
    <select id="page-size-select" name="pageSize" data-page-size-select="true">
      <option value="5">5</option>
      <option value="10">10</option>
      <option value="15">15</option>
      <option value="25">25</option>
      <option value="50" selected>50</option>
      <option value="100">100</option>
    </select>
    <input
      id="page-size-custom"
      name="pageSizeCustom"
      type="number"
      min="5"
      max="100"
      step="1"
      data-page-size-custom="true"
      value=""
    />
  </form>
`

let fixture: HTMLElement | null = null
let mounted: RenderResult | null = null

function mount(): void {
  let host = document.createElement('div')
  host.innerHTML = FIXTURE_HTML
  document.body.appendChild(host)
  fixture = host
  mounted = render(
    <>
      <PageSizeSelectSync />
      <PageSizeCustomKeys presets={PRESETS} min={MIN} max={MAX} />
    </>,
  )
}

function input(): HTMLInputElement {
  return fixture!.querySelector('#page-size-custom') as HTMLInputElement
}

function select(): HTMLSelectElement {
  return fixture!.querySelector('#page-size-select') as HTMLSelectElement
}

function press(target: HTMLInputElement, key: string): KeyboardEvent {
  let event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  })
  target.dispatchEvent(event)
  return event
}

afterEach(() => {
  mounted?.cleanup()
  mounted = null
  fixture?.remove()
  fixture = null
})

describe('page-size entries together', () => {
  it('syncs the preset, prefills on focus, and steps with the page keys', async () => {
    mount()
    await mounted!.act(() => {})
    let custom = input()

    let changed = select()
    changed.value = '50'
    changed.dispatchEvent(new Event('change', { bubbles: true }))
    assert.equal(custom.value, '50', 'selecting a preset must fill the custom input')

    let pageUp = press(custom, 'PageUp')
    assert.equal(custom.value, '100', 'PageUp must jump to the next preset')
    assert.ok(pageUp.defaultPrevented, 'the page must not scroll instead')

    press(custom, 'PageDown')
    assert.equal(custom.value, '50', 'PageDown must jump to the previous preset')

    custom.value = ''
    custom.focus()
    assert.equal(custom.value, '50', 'focus must prefill from the selected preset')

    press(custom, 'End')
    assert.equal(custom.value, '100', 'End must jump to the maximum')

    press(custom, 'Home')
    assert.equal(custom.value, '5', 'Home must jump to the minimum')

    let arrow = press(custom, 'ArrowUp')
    assert.equal(custom.value, '5', 'the entry must leave native fine stepping alone')
    assert.ok(!arrow.defaultPrevented, 'ArrowUp must keep native behavior')
  })
})
