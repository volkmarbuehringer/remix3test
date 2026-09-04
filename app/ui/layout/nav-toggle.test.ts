import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { type Handle } from 'remix/ui'

import { NavToggle } from './nav-toggle.browser.tsx'

type ClassListMock = {
  contains: (className: string) => boolean
  toggle: (className: string) => boolean
}

type DrawerElMock = {
  classList: ClassListMock
  addEventListener: (event: string, handler: Function) => void
}

type BtnElMock = {
  setAttribute: (name: string, value: string) => void
  addEventListener: (event: string, handler: Function) => void
}

type CloseBtnElMock = {
  focus: () => void
}

type PreviousActiveElementMock = {
  focus: () => void
}

describe('NavToggle', () => {
  let originalDocument: typeof globalThis.document
  let drawerEl: DrawerElMock
  let btnEl: BtnElMock
  let closeBtnEl: CloseBtnElMock
  let documentElementStyle: Record<string, string>
  let capturedHandlers: Map<string, Function>
  let isOpen: boolean
  let previousActiveElement: PreviousActiveElementMock

  function setupDom() {
    originalDocument = globalThis.document
    capturedHandlers = new Map()
    isOpen = false
    documentElementStyle = { overflow: '', scrollbarGutter: '' }
    previousActiveElement = { focus: () => {} }

    drawerEl = {
      classList: {
        contains: () => isOpen,
        toggle: () => {
          isOpen = !isOpen
          return isOpen
        },
      },
      addEventListener: (event: string, handler: Function) => {
        capturedHandlers.set('drawer:' + event, handler)
      },
    }

    btnEl = {
      setAttribute: () => {},
      addEventListener: (event: string, handler: Function) => {
        capturedHandlers.set('btn:' + event, handler)
      },
    }

    closeBtnEl = { focus: () => {} }

    let view = {
      scrollX: 0,
      scrollY: 100,
      scrollTo: () => {},
      getComputedStyle: () => ({ scrollbarGutter: 'auto' }),
      innerWidth: 1024,
    }

    globalThis.document = {
      getElementById: (id: string) => {
        if (id === 'nav-drawer') return drawerEl
        if (id === 'nav-toggle') return btnEl
        if (id === 'nav-close') return closeBtnEl
        return null
      },
      body: {},
      documentElement: { style: documentElementStyle, clientWidth: 1000 },
      defaultView: view,
      activeElement: previousActiveElement,
      addEventListener: () => {},
    } as unknown as typeof globalThis.document
  }

  function restore() {
    globalThis.document = originalDocument
  }

  afterEach(() => {
    restore()
  })

  it('exports NavToggle', () => {
    assert.ok(NavToggle)
  })

  it('locks scroll on open and unlocks on close', () => {
    setupDom()

    let handle = {} as unknown as Handle
    let initFn = NavToggle(handle)
    initFn()

    let clickHandler = capturedHandlers.get('btn:click')
    assert.ok(clickHandler, 'click handler should be registered')
    clickHandler!()

    assert.equal(isOpen, true, 'drawer should open')
    assert.equal(
      documentElementStyle.overflow,
      'hidden',
      'scroll should be locked when drawer opens',
    )

    clickHandler!()

    assert.equal(isOpen, false, 'drawer should close')
    assert.equal(documentElementStyle.overflow, '', 'scroll should be unlocked when drawer closes')
  })

  it('restores focus to previous element on close', () => {
    setupDom()

    let focusCalled = false
    previousActiveElement.focus = () => {
      focusCalled = true
    }

    let handle = {} as unknown as Handle
    let initFn = NavToggle(handle)
    initFn()

    let clickHandler = capturedHandlers.get('btn:click')
    clickHandler!()

    // Close
    clickHandler!()

    assert.ok(focusCalled, 'should restore focus to previously active element')
  })

  it('closes on Escape key', () => {
    setupDom()

    let handle = {} as unknown as Handle
    let initFn = NavToggle(handle)
    initFn()

    let clickHandler = capturedHandlers.get('btn:click')
    clickHandler!()
    assert.equal(isOpen, true)

    let keydownHandler = capturedHandlers.get('drawer:keydown')
    assert.ok(keydownHandler)
    keydownHandler!({ key: 'Escape' })

    assert.equal(isOpen, false, 'drawer should close on Escape')
  })

  it('does not close on non-Escape key', () => {
    setupDom()

    let handle = {} as unknown as Handle
    let initFn = NavToggle(handle)
    initFn()

    let clickHandler = capturedHandlers.get('btn:click')
    clickHandler!()

    let keydownHandler = capturedHandlers.get('drawer:keydown')
    keydownHandler!({ key: 'Enter' })

    assert.equal(isOpen, true, 'drawer should stay open on Enter key')
  })

  it('closes on drawer backdrop click', () => {
    setupDom()

    let handle = {} as unknown as Handle
    let initFn = NavToggle(handle)
    initFn()

    let clickHandler = capturedHandlers.get('btn:click')
    clickHandler!()

    let drawerClickHandler = capturedHandlers.get('drawer:click')
    assert.ok(drawerClickHandler)
    drawerClickHandler!()

    assert.equal(isOpen, false, 'drawer should close on backdrop click')
  })
})
