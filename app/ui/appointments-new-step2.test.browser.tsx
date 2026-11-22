import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render, type RenderResult } from 'remix/component/test'

import { AppointmentsNewStep2Live } from './appointments-new-step2.browser.tsx'
import { formatSlotRangeDE } from '../utils/date-utils.ts'

// ---------------------------------------------------------------------------
// AppointmentsNewStep2Live — keeps the wizard's confirm line and submit button
// in sync with the selected time slot.
//
// The change listener is delegated on the document (the form is re-rendered by
// frame navigation), scheduled after the client commit, and scoped to the
// entry's handle signal. The fixture mirrors the server markup from
// appointments-new-step2.tsx: a day_start radio, the confirm line, and the
// submit button.
// ---------------------------------------------------------------------------

const DAY_MS = Date.UTC(2026, 5, 10)
const START_MIN = 540

const FORM_HTML = `
  <form data-wizard-form="true">
    <input type="radio" name="day_start" value="${DAY_MS}:${START_MIN}" />
    <div data-wizard-confirm></div>
    <button type="submit" data-wizard-submit disabled>Weiter</button>
  </form>
`

let fixture: HTMLElement | null = null
let cleanup: (() => void) | null = null

function mount(): void {
  let host = document.createElement('div')
  host.innerHTML = FORM_HTML
  document.body.appendChild(host)
  fixture = host
}

async function renderEntry(): Promise<RenderResult> {
  let result = render(<AppointmentsNewStep2Live />)
  cleanup = result.cleanup
  await result.act(() => undefined)
  return result
}

function form(): HTMLFormElement {
  return fixture?.querySelector('[data-wizard-form]') as HTMLFormElement
}

function slot(): HTMLInputElement {
  return form().querySelector('input[name="day_start"]') as HTMLInputElement
}

function confirmLine(): HTMLElement {
  return form().querySelector('[data-wizard-confirm]') as HTMLElement
}

function submitButton(): HTMLButtonElement {
  return form().querySelector('[data-wizard-submit]') as HTMLButtonElement
}

function selectSlot(): void {
  slot().checked = true
  slot().dispatchEvent(new Event('change', { bubbles: true }))
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('AppointmentsNewStep2Live', () => {
  it('shows the empty hint and keeps submit disabled until a slot is chosen', async () => {
    mount()
    await renderEntry()

    assert.equal(confirmLine().textContent, 'Bitte wählen Sie eine Uhrzeit (60 Minuten).')
    assert.equal(submitButton().disabled, true)
  })

  it('syncs the confirm line and enables submit on a delegated change', async () => {
    mount()
    await renderEntry()

    selectSlot()

    assert.equal(confirmLine().textContent, formatSlotRangeDE(DAY_MS, START_MIN))
    assert.equal(submitButton().disabled, false)
  })

  it('removes its document listener when the entry disconnects', async () => {
    mount()
    await renderEntry()

    cleanup?.()
    cleanup = null

    selectSlot()

    assert.equal(
      confirmLine().textContent,
      'Bitte wählen Sie eine Uhrzeit (60 Minuten).',
      'a disposed entry must not keep syncing the document',
    )
    assert.equal(submitButton().disabled, true)
  })
})
