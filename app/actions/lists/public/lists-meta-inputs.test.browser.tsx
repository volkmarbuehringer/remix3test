import { describe, it, beforeEach, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { ListsClient } from './lists-client.tsx'
import type { ListInitialState } from './lists-state.ts'

// ---------------------------------------------------------------------------
// /lists per-member metadata editor (tags / due date) — browser guard.
//
// The date and tags fields live inside the inline row editor. They are
// UNCONTROLLED (`defaultValue`), like the label textarea. When they were
// controlled (`value=`) with setters that never re-render, the component
// runtime's controlled-reflection listener restored the DOM value toward the
// stale last-render value on every input/change — so a tag could not be typed
// and a picked date disappeared until some unrelated re-render happened to sync
// it (the "adding date or tags is very slow / never shows up" bug).
//
// This pins the correct behaviour: typed value survives without a re-render, and
// it reaches the debounced PUT exactly as typed.
// ---------------------------------------------------------------------------

const originalFetch = window.fetch
let calls: Array<{ method: string; body: unknown }> = []
let cleanup: (() => void) | null = null
let removeCsrf: (() => void) | null = null

function stubFetch(echoItems: unknown) {
  window.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    let body = init?.body ? JSON.parse(String(init.body)) : {}
    calls.push({ method: String(init?.method ?? 'GET'), body })
    let items = Array.isArray(body.items) ? body.items : echoItems
    return new Response(
      JSON.stringify({ id: 7, title: 'x', description: '', items, updated_at: 222 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  }) as typeof window.fetch
}

async function actFlush(result: ReturnType<typeof render>) {
  await result.act(() => {})
}

function editButtonFor(container: HTMLElement, index: number): HTMLButtonElement {
  let btns = [...container.querySelectorAll('button')].filter(
    (b) => b.getAttribute('title') === 'Bearbeiten',
  )
  return btns[index] as HTMLButtonElement
}

let state: ListInitialState = {
  id: 7,
  title: 'x',
  description: '',
  items: [
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
  ],
  updated_at: 111,
}

beforeEach(() => {
  calls = []
  document.querySelectorAll('meta[name="csrf-token"]').forEach((m) => m.remove())
  let meta = document.createElement('meta')
  meta.name = 'csrf-token'
  meta.content = 'tok'
  document.head.appendChild(meta)
  removeCsrf = () => meta.remove()
  stubFetch(state.items)
})

afterEach(() => {
  window.fetch = originalFetch
  removeCsrf?.()
  removeCsrf = null
  cleanup?.()
  cleanup = null
})

describe('lists metadata editor (date + tags)', () => {
  it('keeps typed tags in the DOM without a re-render', async () => {
    let result = render(<ListsClient initialState={state} />)
    cleanup = result.cleanup
    await actFlush(result)

    await result.act(() => editButtonFor(result.container, 0).click())
    await actFlush(result)

    let tags = result.container.querySelector('input[aria-label="Tags"]') as HTMLInputElement
    assert.ok(tags, 'tags field should render when editing a member')

    // Type the way a user does — each keystroke dispatches `input` and only
    // updates the closure (`setEditTags`), never re-renders.
    for (let partial of ['w', 'wo', 'wor', 'work', 'work,', 'work,i', 'work,it']) {
      tags.value = partial
      await result.act(() => tags.dispatchEvent(new Event('input', { bubbles: true })))
    }
    // A microtask flush: a controlled input would have reverted by now.
    await actFlush(result)

    assert.equal(tags.value, 'work,it', 'typed tags must persist without a re-render')
  })

  it('keeps a picked date in the DOM without a re-render', async () => {
    let result = render(<ListsClient initialState={state} />)
    cleanup = result.cleanup
    await actFlush(result)

    await result.act(() => editButtonFor(result.container, 1).click())
    await actFlush(result)

    let due = result.container.querySelector('input[aria-label="Fällig am"]') as HTMLInputElement
    assert.ok(due, 'date field should render when editing a member')

    due.value = '2026-03-04'
    await result.act(() => due.dispatchEvent(new Event('change', { bubbles: true })))
    await actFlush(result)

    assert.equal(due.value, '2026-03-04', 'picked date must persist without a re-render')
  })

  it('sends the typed tags and date verbatim on commit', async () => {
    let result = render(<ListsClient initialState={state} />)
    cleanup = result.cleanup
    await actFlush(result)

    await result.act(() => editButtonFor(result.container, 0).click())
    await actFlush(result)

    let tags = result.container.querySelector('input[aria-label="Tags"]') as HTMLInputElement
    let due = result.container.querySelector('input[aria-label="Fällig am"]') as HTMLInputElement

    tags.value = 'urgent,home'
    await result.act(() => tags.dispatchEvent(new Event('input', { bubbles: true })))
    due.value = '2026-05-06'
    await result.act(() => due.dispatchEvent(new Event('change', { bubbles: true })))

    // Click the row's save (check) action.
    let save = [...result.container.querySelectorAll('button')].find(
      (b) => b.getAttribute('title') === 'Speichern',
    ) as HTMLButtonElement
    await result.act(() => save.click())

    // Wait for the debounced PUT to fire.
    let deadline = Date.now() + 8000
    while (calls.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25))
      await actFlush(result)
    }

    let put = calls.find((c) => c.method === 'PUT')
    assert.ok(put, 'a commit must issue a PUT')
    let sent = put!.body as {
      items: Array<{ id: string; tags?: string[]; due?: string }>
    }
    let itemA = sent.items.find((i) => i.id === 'a')!
    assert.deepEqual(itemA.tags, ['urgent', 'home'], 'typed tags must reach the PUT payload')
    assert.equal(itemA.due, '2026-05-06', 'picked date must reach the PUT payload')
  })
})
