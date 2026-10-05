import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { IntervalBounds } from './interval-bounds.browser.tsx'

// ---------------------------------------------------------------------------
// IntervalBounds — the end-time select must stay after the start time.
//
// The entry (a hidden marker div) wires two selects by id and keeps every end
// option disabled while its value <= the selected start; when the current end
// becomes invalid it jumps to the first valid option. Change events are
// delivered with a plain dispatchEvent on the native select — the listener is
// a real addEventListener, so the remix `on('change')` Firefox caveat does
// not apply here.
// ---------------------------------------------------------------------------

const MIRROR_HTML = `
  <select id="mirror-start">
    <option value="540">09:00</option>
    <option value="600" selected>10:00</option>
    <option value="660">11:00</option>
    <option value="720">12:00</option>
  </select>
  <select id="mirror-end">
    <option value="600">10:00</option>
    <option value="660" selected>11:00</option>
    <option value="720">12:00</option>
    <option value="780">13:00</option>
  </select>
`

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mount(): void {
  let host = document.createElement('div')
  host.innerHTML = MIRROR_HTML
  document.body.appendChild(host)
  fixture = host
}

function mountEntry(): void {
  cleanup = render(<IntervalBounds startId="mirror-start" endId="mirror-end" />).cleanup
}

function start(): HTMLSelectElement {
  return document.getElementById('mirror-start') as HTMLSelectElement
}
function end(): HTMLSelectElement {
  return document.getElementById('mirror-end') as HTMLSelectElement
}

function moveStartTo(value: string): void {
  let select = start()
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('IntervalBounds', () => {
  it('disables end options at or below the start on mount', () => {
    mount()
    mountEntry()

    let options = Array.from(end().options)
    assert.equal(options[0]!.disabled, true, '09:00 end is invalid for a 10:00 start')
    assert.equal(options[1]!.disabled, false, 'the selected 11:00 end stays valid')
    assert.equal(end().value, '660', 'a valid selection is left alone')
  })

  it('lowering the start invalidates the current end and jumps to the first valid one', () => {
    mount()
    mountEntry()

    // Start 11:00 makes the selected end 11:00 invalid (end must be AFTER start).
    // Regression: the "first valid" capture used `firstValidEnd === startMin + 60`
    // as its sentinel, which stayed true for a whole hour-stepped option list and
    // walked the selection to the LAST option instead of the first.
    moveStartTo('660')

    assert.equal(end().value, '720', 'the end jumps to the first option after the start')
    let options = Array.from(end().options)
    assert.equal(options[0]!.disabled, true)
    assert.equal(options[1]!.disabled, true, '11:00 end is disabled for an 11:00 start')
    assert.equal(options[2]!.disabled, false)
  })

  it('raising the start again re-enables the earlier options', () => {
    mount()
    mountEntry()

    moveStartTo('540')
    assert.equal(Array.from(end().options)[0]!.disabled, false, '10:00 valid for a 09:00 start')

    moveStartTo('720')
    assert.equal(end().value, '780', 'even the previously valid 12:00 jumps past the new start')
  })

  it('does nothing when the target selects do not exist', () => {
    cleanup = render(<IntervalBounds startId="ghost-start" endId="ghost-end" />).cleanup
    // No throw, no side effects on the (absent) selects.
    assert.equal(document.getElementById('ghost-start'), null)
  })
})
