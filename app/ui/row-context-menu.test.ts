import { afterEach, describe, it } from 'remix/test'
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
let navigations: string[] = []
let confirmations: Array<string | undefined> = []
let submits: string[] = []

function setup(fixture: Fixture) {
  navigations = []
  confirmations = []
  submits = []

  let originalDocument = globalThis.document
  let originalWindow = globalThis.window
  let originalConfirm = globalThis.confirm

  let location = { href: '' }
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
  } as unknown as typeof globalThis.document
  globalThis.window = { location } as unknown as typeof globalThis.window
  globalThis.confirm = ((message?: string) => {
    confirmations.push(message)
    return fixture.confirm ? fixture.confirm(message) : true
  }) as typeof globalThis.confirm

  // `safeNavigate` falls back to a full-page load and records it here.
  Object.defineProperty(location, 'href', {
    get: () => '',
    set: (value: string) => {
      navigations.push(value)
    },
  })

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
})

describe('navigateGridParam', () => {
  it('preserves the grid state and puts the navigation param first', () => {
    setup({
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

    assert.deepEqual(navigations, [
      '/admin/users?editing=5&offset=15&sort=name&order=desc&filter=ada&period=week&status=active',
    ])
  })

  it('falls back to the default sort/order and drops empty values', () => {
    setup({ blob: JSON.stringify({ baseHref: '/b' }) })

    navigateGridParam({} as never, navigation, 'config', '9')

    assert.deepEqual(navigations, ['/b?config=9&sort=x.id&order=asc'])
  })

  it('does nothing when the grid-state blob is absent', () => {
    setup({ blob: null })

    navigateGridParam({} as never, navigation, 'editing', '5')

    assert.deepEqual(navigations, [])
  })

  it('falls back to the bare URL when the blob is malformed', () => {
    setup({ blob: 'not json' })

    navigateGridParam({} as never, navigation, 'editing', '5')

    assert.deepEqual(navigations, ['/fallback?editing=5'])
  })
})

describe('submitRowForm', () => {
  it('submits the form identified by the data attribute', () => {
    setup({ blob: null, forms: form('form[data-toggle-form="5"]') })

    submitRowForm('5', 'data-toggle-form')

    assert.deepEqual(submits, ['form[data-toggle-form="5"]'])
  })

  it('does nothing when the form is absent', () => {
    setup({ blob: null })

    submitRowForm('5', 'data-toggle-form')

    assert.deepEqual(submits, [])
  })
})

describe('confirmAndSubmitRowForm', () => {
  it('confirms then submits', () => {
    setup({ blob: null, forms: form('form[data-delete-form="5"]') })

    confirmAndSubmitRowForm('5', 'Wirklich löschen?')

    assert.deepEqual(confirmations, ['Wirklich löschen?'])
    assert.deepEqual(submits, ['form[data-delete-form="5"]'])
  })

  it('does not submit when declined', () => {
    setup({ blob: null, forms: form('form[data-delete-form="5"]'), confirm: () => false })

    confirmAndSubmitRowForm('5', 'Wirklich löschen?')

    assert.deepEqual(confirmations, ['Wirklich löschen?'])
    assert.deepEqual(submits, [])
  })
})

describe('confirmFromFormAndSubmit', () => {
  it("prefers the form's own data-confirm message", () => {
    setup({
      blob: null,
      forms: form('form[data-delete-form="5"]', 'Termin wirklich löschen?'),
    })

    confirmFromFormAndSubmit('5', 'Wirklich löschen?')

    assert.deepEqual(confirmations, ['Termin wirklich löschen?'])
    assert.deepEqual(submits, ['form[data-delete-form="5"]'])
  })

  it('does not prompt or submit when the form is absent', () => {
    setup({ blob: null })

    confirmFromFormAndSubmit('5', 'Wirklich löschen?')

    assert.deepEqual(confirmations, [])
    assert.deepEqual(submits, [])
  })
})
