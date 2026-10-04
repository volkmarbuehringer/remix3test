import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { DeletePastButton } from './admin-delete-past-button.tsx'

// DeletePastButton posts a synthetic form carrying the current grid state, after
// a count-aware confirm. `form.submit()` is stubbed so nothing navigates; the
// captured element still exposes its action and hidden fields.

const originalConfirm = window.confirm
const originalSubmit = HTMLFormElement.prototype.submit

let cleanup: (() => void) | null = null
let confirmResult = true
let confirmMessage = ''
let submitted: HTMLFormElement[] = []

function renderButton(props: { pastCount: number; status?: string; deletePastHref?: string }) {
  let result = render(
    <DeletePastButton
      csrfToken="csrf-token"
      offset="10"
      sort="date"
      order="asc"
      filter="f"
      period="month"
      {...(props.status !== undefined ? { status: props.status } : {})}
      pastCount={props.pastCount}
      deletePastHref={props.deletePastHref ?? '/verwaltung/offerings/delete-past'}
    />,
  )
  cleanup = result.cleanup
  return result
}

function buttonOf(container: HTMLElement): HTMLButtonElement {
  return container.querySelector('button') as HTMLButtonElement
}

function fieldValue(form: HTMLFormElement, name: string): string | null {
  return (form.querySelector(`input[name="${name}"]`) as HTMLInputElement | null)?.value ?? null
}

beforeEach(() => {
  confirmResult = true
  confirmMessage = ''
  submitted = []
  window.confirm = ((message?: string) => {
    confirmMessage = message ?? ''
    return confirmResult
  }) as typeof window.confirm
  HTMLFormElement.prototype.submit = function () {
    submitted.push(this)
  }
})

afterEach(() => {
  window.confirm = originalConfirm
  HTMLFormElement.prototype.submit = originalSubmit
  cleanup?.()
  cleanup = null
})

describe('DeletePastButton', () => {
  it('is disabled and explains itself when there is nothing to delete', () => {
    let result = renderButton({ pastCount: 0 })
    let button = buttonOf(result.container)

    assert.equal(button.disabled, true)
    assert.equal(button.getAttribute('title'), 'Keine vergangenen Angebote zu löschen.')
    assert.equal(button.textContent, 'Vergangene löschen')
  })

  it('submits the grid state after confirmation', () => {
    let result = renderButton({ pastCount: 2 })

    buttonOf(result.container).click()

    assert.equal(confirmMessage, 'Wirklich 2 vergangene Angebote löschen?')
    assert.equal(submitted.length, 1)
    let form = submitted[0]!
    assert.equal(form.method, 'post')
    assert.equal(new URL(form.action).pathname, '/verwaltung/offerings/delete-past')
    assert.equal(fieldValue(form, '_csrf'), 'csrf-token')
    assert.equal(fieldValue(form, '_offset'), '10')
    assert.equal(fieldValue(form, '_sort'), 'date')
    assert.equal(fieldValue(form, '_order'), 'asc')
    assert.equal(fieldValue(form, '_filter'), 'f')
    assert.equal(fieldValue(form, '_period'), 'month')
    assert.equal(fieldValue(form, '_status'), null, 'status is omitted when absent')
  })

  it('uses the singular noun and carries an optional status', () => {
    let result = renderButton({ pastCount: 1, status: 'open' })

    buttonOf(result.container).click()

    assert.equal(confirmMessage, 'Wirklich 1 vergangenes Angebot löschen?')
    assert.equal(fieldValue(submitted[0]!, '_status'), 'open')
  })

  it('does not submit when the confirmation is declined', () => {
    let result = renderButton({ pastCount: 3 })
    confirmResult = false

    buttonOf(result.container).click()

    assert.equal(confirmMessage, 'Wirklich 3 vergangene Angebote löschen?')
    assert.equal(submitted.length, 0)
  })
})
