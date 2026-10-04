import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { Report1FilterAutoSubmit } from './report1-filter-autosubmit.browser.tsx'

// The server contract (the form carries `data-report1-filters="true"`) is asserted
// by report1-index.test.ts; this test covers the client reaction to it. The entry
// renders nothing and attaches a delegated document `change` listener scoped to
// that marked form, so the fixture must carry the marker verbatim.

const FIXTURE_HTML = `
  <form data-report1-filters="true" action="/verwaltung/report1" method="GET">
    <select name="month">
      <option value="1">Januar</option>
      <option value="2">Februar</option>
    </select>
    <select name="year">
      <option value="2026">2026</option>
    </select>
    <button type="submit">Auswertung erstellen</button>
  </form>
  <form id="other-filters" action="/verwaltung/report1" method="GET">
    <select name="pageSize">
      <option value="10">10</option>
    </select>
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

function selectOf(host: HTMLElement, name: string): HTMLSelectElement {
  return host.querySelector(`select[name="${name}"]`) as HTMLSelectElement
}

function trackSubmits(form: HTMLFormElement): () => number {
  let count = 0
  form.addEventListener('submit', (event) => {
    event.preventDefault()
    count++
  })
  return () => count
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
})

describe('Report1FilterAutoSubmit', () => {
  it('submits the marked filter form when one of its selects changes', () => {
    let host = mount()
    let submits = trackSubmits(host.querySelector('form[data-report1-filters]') as HTMLFormElement)
    cleanup = render(<Report1FilterAutoSubmit />).cleanup

    let select = selectOf(host, 'month')
    select.value = '2'
    select.dispatchEvent(new Event('change', { bubbles: true }))

    assert.equal(submits(), 1, 'changing a filter select should requestSubmit the form')
  })

  it('leaves a select outside the marked form alone', () => {
    let host = mount()
    let marked = trackSubmits(host.querySelector('form[data-report1-filters]') as HTMLFormElement)
    let other = trackSubmits(host.querySelector('#other-filters') as HTMLFormElement)
    cleanup = render(<Report1FilterAutoSubmit />).cleanup

    selectOf(host, 'pageSize').dispatchEvent(new Event('change', { bubbles: true }))

    assert.equal(marked(), 0, 'the marked form must not be submitted')
    assert.equal(other(), 0, 'the entry only submits the marked form')
  })

  it('ignores non-change events on a filter select', () => {
    let host = mount()
    let submits = trackSubmits(host.querySelector('form[data-report1-filters]') as HTMLFormElement)
    cleanup = render(<Report1FilterAutoSubmit />).cleanup

    selectOf(host, 'month').dispatchEvent(new Event('input', { bubbles: true }))

    assert.equal(submits(), 0)
  })
})
