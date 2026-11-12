import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'

import { waitForDom } from '../../../../test/dom.ts'
import { ListsClient } from './lists-client.tsx'
import { applyListReorder } from './lists-view-transition.ts'

// ---------------------------------------------------------------------------
// Lists reorder View Transition.
//
// The helper names keyed rows right before `document.startViewTransition()`,
// re-applies the names inside the update callback, and removes them once the
// transition settles. The browser suite stubs the API so each phase is
// observable; the no-support and reduced-motion paths must stay synchronous.
// The integration cases drive the real ListsClient reorder handler.
// ---------------------------------------------------------------------------

type ViewTransitionLike = {
  finished: Promise<void>
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void | Promise<void>) => ViewTransitionLike
}

const originalFetch = window.fetch
let cleanup: (() => void) | null = null
let fixture: HTMLElement | null = null
let restoreViewTransition: (() => void) | null = null
let restoreMatchMedia: (() => void) | null = null

function installViewTransition(
  impl: ((update: () => void | Promise<void>) => ViewTransitionLike) | undefined,
): void {
  let doc = document as ViewTransitionDocument
  let hadOwn = Object.prototype.hasOwnProperty.call(doc, 'startViewTransition')
  let original = doc.startViewTransition
  Object.defineProperty(doc, 'startViewTransition', {
    configurable: true,
    writable: true,
    value: impl,
  })
  restoreViewTransition = () => {
    if (hadOwn) {
      Object.defineProperty(doc, 'startViewTransition', {
        configurable: true,
        writable: true,
        value: original,
      })
    } else {
      Reflect.deleteProperty(doc, 'startViewTransition')
    }
  }
}

function stubReducedMotion(reduce: boolean): void {
  let original = window.matchMedia
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
  restoreMatchMedia = () => {
    window.matchMedia = original
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void
  let promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function mountRows(html = ''): HTMLElement {
  fixture = document.createElement('div')
  fixture.innerHTML =
    html ||
    '<div data-item-id="a">A</div><div data-item-id="b">B</div><div data-item-id="c">C</div>'
  document.body.append(fixture)
  return fixture
}

function transitionNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('[data-item-id]')].map((row) =>
    row.style.getPropertyValue('view-transition-name'),
  )
}

function rowIds(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('[data-item-id]')].map(
    (row) => row.dataset.itemId ?? '',
  )
}

function stubFetch() {
  window.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
    let body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {}
    let state = {
      id: 7,
      title: typeof body.title === 'string' ? body.title : 'VT',
      description: 'seeded for the reorder-transition suite',
      items: Array.isArray(body.items) ? body.items : [],
      updated_at: 222,
    }
    return new Response(JSON.stringify(state), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof window.fetch
}

function renderEditor() {
  let result = render(
    <ListsClient
      initialState={{
        id: 7,
        title: 'VT',
        description: 'seeded for the reorder-transition suite',
        items: [
          { id: 'a', label: 'Alpha' },
          { id: 'b', label: 'Beta' },
          { id: 'c', label: 'Gamma' },
        ],
        updated_at: 111,
      }}
    />,
  )
  cleanup = result.cleanup
  return result
}

function moveDownButton(container: HTMLElement, id: string): HTMLButtonElement {
  let button = container.querySelector<HTMLButtonElement>(
    `[data-item-id="${id}"] button[aria-label="Nach unten"]`,
  )
  assert.ok(button, `row ${id} must offer Nach unten`)
  return button
}

function settle(ms = 0) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

afterEach(() => {
  cleanup?.()
  cleanup = null
  fixture?.remove()
  fixture = null
  restoreViewTransition?.()
  restoreViewTransition = null
  restoreMatchMedia?.()
  restoreMatchMedia = null
  window.fetch = originalFetch
})

describe('applyListReorder', () => {
  it('names rows for the snapshots and clears them after the transition settles', async () => {
    let calls = 0
    let updates: Array<() => void | Promise<void>> = []
    let finished = deferred()
    installViewTransition((update) => {
      calls++
      updates.push(update)
      return { finished: finished.promise }
    })
    let container = mountRows()
    let applied = 0

    applyListReorder(container, () => {
      applied++
    })

    assert.equal(calls, 1, 'the reorder starts one view transition')
    assert.equal(applied, 0, 'the state update waits for the update callback')
    assert.deepEqual(
      transitionNames(container),
      ['list-item-a', 'list-item-b', 'list-item-c'],
      'the old snapshot sees one name per keyed row',
    )

    await updates[0]!()

    assert.equal(applied, 1)
    assert.deepEqual(
      transitionNames(container),
      ['list-item-a', 'list-item-b', 'list-item-c'],
      'the new snapshot keeps the names',
    )

    finished.resolve()
    await finished.promise
    await Promise.resolve()

    assert.deepEqual(
      transitionNames(container),
      ['', '', ''],
      'the names are removed once the transition settles',
    )
  })

  it('names re-created rows inside the update callback', async () => {
    let updates: Array<() => void | Promise<void>> = []
    let finished = deferred()
    installViewTransition((update) => {
      updates.push(update)
      return { finished: finished.promise }
    })
    let container = mountRows()

    applyListReorder(container, () => {
      container.innerHTML = '<div data-item-id="b">B</div><div data-item-id="a">A</div>'
    })
    await updates[0]!()

    assert.deepEqual(transitionNames(container), ['list-item-b', 'list-item-a'])
    finished.resolve()
  })

  it('sanitizes ids into a valid custom-ident', async () => {
    let updates: Array<() => void | Promise<void>> = []
    let finished = deferred()
    installViewTransition((update) => {
      updates.push(update)
      return { finished: finished.promise }
    })
    let container = mountRows('<div data-item-id="it:1 two">Item</div>')

    applyListReorder(container, () => {})
    await updates[0]!()

    assert.equal(
      transitionNames(container)[0],
      'list-item-it-1-two',
      'punctuation cannot leak into view-transition-name',
    )
    finished.resolve()
  })

  it('falls back to an instant reorder without platform support', () => {
    installViewTransition(undefined)
    let container = mountRows()
    let applied = 0

    applyListReorder(container, () => {
      applied++
    })

    assert.equal(applied, 1, 'the update runs synchronously')
    assert.deepEqual(transitionNames(container), ['', '', ''])
  })

  it('falls back to an instant reorder under prefers-reduced-motion', () => {
    stubReducedMotion(true)
    let calls = 0
    installViewTransition((_update) => {
      calls++
      return { finished: Promise.resolve() }
    })
    let container = mountRows()
    let applied = 0

    applyListReorder(container, () => {
      applied++
    })

    assert.equal(calls, 0, 'reduced motion must not start a view transition')
    assert.equal(applied, 1)
    assert.deepEqual(transitionNames(container), ['', '', ''])
  })

  it('runs the update exactly once when startViewTransition throws', () => {
    installViewTransition(() => {
      throw new Error('transition unavailable')
    })
    let container = mountRows()
    let applied = 0

    applyListReorder(container, () => {
      applied++
    })

    assert.equal(applied, 1)
    assert.deepEqual(transitionNames(container), ['', '', ''])
  })

  it('does not let a superseded transition clear the newer names', async () => {
    let updates: Array<() => void | Promise<void>> = []
    let first = deferred()
    let second = deferred()
    let count = 0
    installViewTransition((update) => {
      updates.push(update)
      count++
      return { finished: count === 1 ? first.promise : second.promise }
    })
    let container = mountRows()

    applyListReorder(container, () => {})
    applyListReorder(container, () => {})
    assert.equal(updates.length, 2)

    first.resolve()
    await first.promise
    await Promise.resolve()
    assert.deepEqual(
      transitionNames(container),
      ['list-item-a', 'list-item-b', 'list-item-c'],
      'the stale transition must not strip names the newer transition owns',
    )

    second.resolve()
    await second.promise
    await Promise.resolve()
    assert.deepEqual(transitionNames(container), ['', '', ''])
  })
})

describe('ListsClient reorder View Transition', () => {
  it('wraps a keyboard row move and leaves the order for the transition callback', async () => {
    stubFetch()
    let calls = 0
    let updates: Array<() => void | Promise<void>> = []
    let finished = deferred()
    installViewTransition((update) => {
      calls++
      updates.push(update)
      return { finished: finished.promise }
    })
    let result = renderEditor()

    await result.act(() => moveDownButton(result.container, 'a').click())

    assert.equal(calls, 1, 'the move starts one view transition')
    assert.deepEqual(rowIds(result.container), ['a', 'b', 'c'], 'the reorder is deferred')
    assert.deepEqual(
      transitionNames(result.container),
      ['list-item-a', 'list-item-b', 'list-item-c'],
      'the old snapshot is named before the update',
    )

    await result.act(async () => {
      await updates[0]!()
    })

    assert.deepEqual(rowIds(result.container), ['b', 'a', 'c'], 'the row moved inside the update')
    assert.deepEqual(
      transitionNames(result.container),
      ['list-item-b', 'list-item-a', 'list-item-c'],
      'names follow the moved rows',
    )

    finished.resolve()
    await result.act(async () => {
      await finished.promise
    })
    assert.deepEqual(transitionNames(result.container), ['', '', ''])

    // Let the fast autosave flush against the stub so no timer leaks.
    await settle(350)
  })

  it('runs inside the platform startViewTransition when the API exists', async () => {
    stubFetch()
    let doc = document as ViewTransitionDocument
    let original = doc.startViewTransition
    let calls = 0
    let transitions: ViewTransitionLike[] = []

    if (typeof original === 'function') {
      installViewTransition((update) => {
        calls++
        let transition = original.call(document, update)
        transitions.push(transition)
        return transition
      })
    } else {
      installViewTransition(undefined)
    }

    let result = renderEditor()
    await result.act(() => moveDownButton(result.container, 'a').click())

    await waitForDom(() => rowIds(result.container).join(',') === 'b,a,c', {
      root: result.container,
      description: 'the platform transition to apply the reorder',
    })

    // Moved from lists-reorder-transition.test.e2e.ts: the platform path must
    // start exactly one transition when the API exists and fall back to an
    // instant reorder when it does not. Chromium and Firefox both implement
    // same-document transitions; the branch keeps the contract honest.
    assert.equal(
      calls,
      typeof original === 'function' ? 1 : 0,
      typeof original === 'function'
        ? 'the reorder must run in exactly one same-document view transition'
        : 'an unsupported platform must fall back to an instant reorder',
    )

    if (transitions[0]) {
      await result.act(async () => {
        await transitions[0]!.finished
      })
      assert.deepEqual(transitionNames(result.container), ['', '', ''])
    }

    // Let the fast autosave flush against the stub so no timer leaks.
    await settle(350)
  })

  it('reorders instantly under prefers-reduced-motion', async () => {
    stubFetch()
    stubReducedMotion(true)
    let calls = 0
    installViewTransition((_update) => {
      calls++
      return { finished: Promise.resolve() }
    })
    let result = renderEditor()

    await result.act(() => moveDownButton(result.container, 'a').click())

    assert.equal(calls, 0, 'reduced motion must not start a view transition')
    assert.deepEqual(rowIds(result.container), ['b', 'a', 'c'])
    assert.deepEqual(transitionNames(result.container), ['', '', ''])

    await settle(350)
  })
})
