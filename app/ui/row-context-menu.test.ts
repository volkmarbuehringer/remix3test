import { afterEach, describe, it, type MockProperty, type TestContext } from 'remix/test'
import * as assert from 'remix/assert'

import {
  confirmAndSubmitRowForm,
  confirmFromFormAndSubmit,
  navigateGridParam,
  submitRowForm,
  type GridNavigation,
} from './row-context-menu.tsx'

const navigation: GridNavigation = {
  stateElementId: 'test-grid-state',
  fallbackBaseHref: '/fallback',
  defaultSort: 'x.id',
}

interface FakeForm {
  requestSubmit: () => void
  getAttribute: (name: string) => string | null
}

interface Fixture {
  blob: string | null
  forms?: Record<string, FakeForm>
  confirm?: (message?: string) => boolean
}

let restores: Array<() => void> = []
let hrefMock: MockProperty<{ href: string }, 'href'> | null = null
let confirmations: Array<string | undefined> = []
let submits: string[] = []

/** The URLs `safeNavigate` wrote through the mocked `location.href` setter. */
function recordedNavigations(): string[] {
  return (
    hrefMock?.mock.accesses
      .filter((access) => access.type === 'set')
      .map((access) => access.value) ?? []
  )
}

function setup(t: TestContext, fixture: Fixture) {
  confirmations = []
  submits = []

  let originalDocument = globalThis.document
  let originalWindow = globalThis.window
  let originalConfirm = globalThis.confirm

  let location = { href: '' }
  hrefMock = t.mock.property(location, 'href', '')
  let forms = fixture.forms ?? {}

  globalThis.document = {
    getElementById(id: string) {
      return id === navigation.stateElementId && fixture.blob !== null
        ? { textContent: fixture.blob }
        : null
    },
    querySelector(selector: string) {
      return forms[selector] ?? null
    },
    // No ConfirmDelete dialog is mounted in these unit tests, so dispatching the
    // cancelable confirm event reaches no listener: `defaultPrevented` stays
    // false and `requestConfirm` returns false, exercising the window.confirm
    // fallback. A real EventTarget with no listener also returns true.
    dispatchEvent() {
      return true
    },
  } as unknown as typeof globalThis.document
  globalThis.window = { location: hrefMock } as unknown as typeof globalThis.window
  globalThis.confirm = ((message?: string) => {
    confirmations.push(message)
    return fixture.confirm ? fixture.confirm(message) : true
  }) as typeof globalThis.confirm

  restores.push(() => {
    globalThis.document = originalDocument
    globalThis.window = originalWindow
    globalThis.confirm = originalConfirm
  })
}

function form(selector: string, dataConfirm: string | null = null): Record<string, FakeForm> {
  return {
    [selector]: {
      requestSubmit() {
        submits.push(selector)
      },
      getAttribute(name: string) {
        return name === 'data-confirm' ? dataConfirm : null
      },
    },
  }
}

afterEach(() => {
  for (let restore of restores) restore()
  restores = []
  hrefMock = null
})

describe('navigateGridParam', () => {
  it('preserves the grid state and puts the navigation param first', (t) => {
    setup(t, {
      blob: JSON.stringify({
        offset: '15',
        sort: 'name',
        order: 'desc',
        filter: 'ada',
        period: 'week',
        status: 'active',
        baseHref: '/admin/users',
      }),
    })

    navigateGridParam({} as never, navigation, 'editing', '5')

    assert.deepEqual(recordedNavigations(), [
      '/admin/users?editing=5&offset=15&sort=name&order=desc&filter=ada&period=week&status=active',
    ])
  })

  it('falls back to the default sort/order and drops empty values', (t) => {
    setup(t, { blob: JSON.stringify({ baseHref: '/b' }) })

    navigateGridParam({} as never, navigation, 'config', '9')

    assert.deepEqual(recordedNavigations(), ['/b?config=9&sort=x.id&order=asc'])
  })

  it('does nothing when the grid-state blob is absent', (t) => {
    setup(t, { blob: null })

    navigateGridParam({} as never, navigation, 'editing', '5')

    assert.deepEqual(recordedNavigations(), [])
  })

  it('falls back to the bare URL when the blob is malformed', (t) => {
    setup(t, { blob: 'not json' })

    navigateGridParam({} as never, navigation, 'editing', '5')

    assert.deepEqual(recordedNavigations(), ['/fallback?editing=5'])
  })
})

describe('submitRowForm', () => {
  it('submits the form identified by the data attribute', (t) => {
    setup(t, { blob: null, forms: form('form[data-toggle-form="5"]') })

    submitRowForm('5', 'data-toggle-form')

    assert.deepEqual(submits, ['form[data-toggle-form="5"]'])
  })

  it('does nothing when the form is absent', (t) => {
    setup(t, { blob: null })

    submitRowForm('5', 'data-toggle-form')

    assert.deepEqual(submits, [])
  })
})

describe('confirmAndSubmitRowForm', () => {
  it('confirms then submits', (t) => {
    setup(t, { blob: null, forms: form('form[data-delete-form="5"]') })

    confirmAndSubmitRowForm('5', 'Wirklich löschen?')

    assert.deepEqual(confirmations, ['Wirklich löschen?'])
    assert.deepEqual(submits, ['form[data-delete-form="5"]'])
  })

  it('does not submit when declined', (t) => {
    setup(t, { blob: null, forms: form('form[data-delete-form="5"]'), confirm: () => false })

    confirmAndSubmitRowForm('5', 'Wirklich löschen?')

    assert.deepEqual(confirmations, ['Wirklich löschen?'])
    assert.deepEqual(submits, [])
  })
})

describe('confirmFromFormAndSubmit', () => {
  it("prefers the form's own data-confirm message", (t) => {
    setup(t, {
      blob: null,
      forms: form('form[data-delete-form="5"]', 'Termin wirklich löschen?'),
    })

    confirmFromFormAndSubmit('5', 'Wirklich löschen?')

    assert.deepEqual(confirmations, ['Termin wirklich löschen?'])
    assert.deepEqual(submits, ['form[data-delete-form="5"]'])
  })

  it('does not prompt or submit when the form is absent', (t) => {
    setup(t, { blob: null })

    confirmFromFormAndSubmit('5', 'Wirklich löschen?')

    assert.deepEqual(confirmations, [])
    assert.deepEqual(submits, [])
  })
})
