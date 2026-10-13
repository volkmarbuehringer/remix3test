import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsClient } from './lists-client.tsx'
import type { ListInitialState } from './lists-state.ts'

// Slice 2 (error rework): a failed write must no longer replace the whole
// editor with red text and no way forward. It surfaces as an in-place banner
// with an "Erneut versuchen" action, the save-status pill becomes actionable,
// and an offline/online transition keeps the dirty state and retries on
// reconnect. fetch is stubbed so the failing PUT is deterministic.

const originalFetch = window.fetch
let calls: Array<{ url: string; init: RequestInit }> = []
let failWrites = true
let cleanup: (() => void) | null = null
let removeCsrf: (() => void) | null = null

function installCsrf(token: string) {
  document.querySelectorAll('meta[name="csrf-token"]').forEach((meta) => meta.remove())
  let meta = document.createElement('meta')
  meta.name = 'csrf-token'
  meta.content = token
  document.head.appendChild(meta)
  removeCsrf = () => meta.remove()
}

function state(): ListInitialState {
  return {
    id: 7,
    title: 'Alt',
    description: 'D',
    items: [{ id: 'i1', label: 'A' }],
    updated_at: 111,
  }
}

function stubFetch() {
  window.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    let method = init?.method ?? 'GET'
    if (method !== 'GET' && failWrites) {
      return new Response('kaputt', { status: 500 })
    }
    let body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
    let responseState = {
      id: 7,
      title: typeof body.title === 'string' ? body.title : 'Alt',
      description: 'D',
      items: Array.isArray(body.items) ? body.items : [{ id: 'i1', label: 'A' }],
      updated_at: 222,
    }
    return new Response(JSON.stringify(responseState), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof window.fetch
}

function renderEditor() {
  let result = render(<ListsClient initialState={state()} />)
  cleanup = result.cleanup
  return result
}

function titleInputOf(container: HTMLElement): HTMLInputElement | null {
  return container.querySelector('#lists-title')
}

function typeTitle(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

async function waitFor(predicate: () => boolean, timeout = 8000): Promise<boolean> {
  let deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    if (predicate()) return true
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  return predicate()
}

beforeEach(() => {
  calls = []
  failWrites = true
  installCsrf('tok')
  stubFetch()
})

afterEach(() => {
  window.fetch = originalFetch
  removeCsrf?.()
  removeCsrf = null
  cleanup?.()
  cleanup = null
})

describe('ListsClient save failures', () => {
  it('keeps the editor mounted and offers a retry when a save fails', async () => {
    let result = renderEditor()
    typeTitle(titleInputOf(result.container)!, 'Neu')

    assert.ok(
      await waitFor(() => !!result.container.querySelector('[data-save-error-banner]')),
      'the failed write surfaces as an in-place banner',
    )
    assert.ok(titleInputOf(result.container), 'the title input must stay mounted')
    assert.equal(titleInputOf(result.container)!.value, 'Neu', 'the typed value survives')
    assert.ok(
      result.container.textContent?.includes('Speichern fehlgeschlagen'),
      'the banner states the reason',
    )

    let retry = result.container.querySelector<HTMLButtonElement>('[data-save-retry]')
    assert.ok(retry, 'a retry action is offered')
    assert.equal(retry!.textContent?.trim(), 'Erneut versuchen')

    failWrites = false
    await result.act(() => retry!.click())

    assert.ok(
      await waitFor(
        () =>
          !result.container.querySelector('[data-save-error-banner]') &&
          result.container.textContent?.includes('Gespeichert') === true,
      ),
      'a successful retry clears the banner and reports "Gespeichert"',
    )
    assert.ok(titleInputOf(result.container), 'the editor is still mounted after the retry')
  })

  it('makes the Fehler status pill actionable', async () => {
    let result = renderEditor()
    typeTitle(titleInputOf(result.container)!, 'Neu')

    assert.ok(
      await waitFor(() => !!result.container.querySelector('[data-save-status-retry]')),
      'the error pill exposes a retry control',
    )
    let pill = result.container.querySelector<HTMLButtonElement>('[data-save-status-retry]')!
    assert.ok(pill.textContent?.includes('Fehler'), 'the pill still reads "Fehler"')

    failWrites = false
    await result.act(() => pill.click())

    assert.ok(
      await waitFor(() => result.container.textContent?.includes('Gespeichert') === true),
      'retrying from the pill saves the list',
    )
  })

  it('announces offline and retries the failed save on reconnect', async () => {
    let result = renderEditor()
    typeTitle(titleInputOf(result.container)!, 'Neu')
    assert.ok(
      await waitFor(() => !!result.container.querySelector('[data-save-error-banner]')),
      'sanity: the write fails first',
    )
    let writesBefore = calls.length

    window.dispatchEvent(new Event('offline'))
    assert.ok(
      await waitFor(() => !!result.container.querySelector('[data-offline-banner]')),
      'losing the connection is surfaced',
    )

    failWrites = false
    window.dispatchEvent(new Event('online'))
    assert.ok(
      await waitFor(() => !result.container.querySelector('[data-offline-banner]')),
      'reconnecting clears the offline banner',
    )
    assert.ok(
      await waitFor(
        () =>
          calls.length > writesBefore &&
          result.container.textContent?.includes('Gespeichert') === true,
      ),
      'reconnecting retries the pending save',
    )
  })
})
