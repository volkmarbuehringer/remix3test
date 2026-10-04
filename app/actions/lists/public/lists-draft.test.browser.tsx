import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsClient } from './lists-client.tsx'

// The unsaved new-list draft lives in sessionStorage ('lists:draft:new') and is
// restored on mount for a fresh new list. The component schedules that read with
// setTimeout(0) (see reloadFromFrame), so each test awaits one macrotask and
// flushes the queued update. Extracted from lists-client-edit.test.e2e.ts; the
// navigation + autosave-debounce halves stay e2e (real Frame reload / server).

const DRAFT_KEY = 'lists:draft:new'

let cleanup: (() => void) | null = null

async function renderEditor() {
  let result = render(<ListsClient initialState={null} />)
  cleanup = result.cleanup
  await result.act(() => new Promise((resolve) => setTimeout(resolve, 0)))
  return result
}

function titleInputOf(container: HTMLElement): HTMLInputElement {
  return container.querySelector('#lists-title') as HTMLInputElement
}

function discardButtonOf(container: HTMLElement): HTMLButtonElement | null {
  return (
    [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Entwurf verwerfen'),
    ) ?? null
  )
}

beforeEach(() => {
  sessionStorage.removeItem(DRAFT_KEY)
})

afterEach(() => {
  cleanup?.()
  cleanup = null
  sessionStorage.removeItem(DRAFT_KEY)
})

describe('ListsClient unsaved draft', () => {
  it('restores a stored draft into the editor with the banner and items', async () => {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        title: 'Entwurf Titel',
        description: 'Entwurf Beschreibung',
        items: [{ id: 'draft-1', label: 'Entwurf Element' }],
      }),
    )

    let result = await renderEditor()

    assert.equal(titleInputOf(result.container).value, 'Entwurf Titel')
    assert.ok(result.container.textContent?.includes('Entwurf Element'))
    assert.ok(
      result.container.textContent?.includes(
        'Ein ungespeicherter Entwurf wurde wiederhergestellt.',
      ),
    )
    assert.ok(discardButtonOf(result.container), 'the discard control must be offered')
  })

  it('starts clean when there is no stored draft', async () => {
    let result = await renderEditor()

    assert.equal(titleInputOf(result.container).value, '')
    assert.equal(discardButtonOf(result.container), null)
  })

  it('ignores a corrupt draft instead of throwing', async () => {
    sessionStorage.setItem(DRAFT_KEY, '{not valid json')

    let result = await renderEditor()

    assert.equal(titleInputOf(result.container).value, '')
    assert.equal(discardButtonOf(result.container), null)
  })

  it('clears the editor and the stored draft when the banner is dismissed', async () => {
    sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ title: 'Weg damit', description: '', items: [] }),
    )
    let result = await renderEditor()

    await result.act(() => {
      discardButtonOf(result.container)!.click()
    })

    assert.equal(titleInputOf(result.container).value, '')
    assert.equal(sessionStorage.getItem(DRAFT_KEY), null)
    assert.equal(discardButtonOf(result.container), null)
  })
})
