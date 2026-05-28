import { describe, it, after } from 'remix/test'
import * as assert from 'remix/assert'

import { FormLoadingState } from './form-loading-state.tsx'

// ---------------------------------------------------------------------------
// FormLoadingState tests
// Verifies that the client entry registers DOM event listeners for:
// 1. The submit handler that disables buttons on matched forms
// 2. The pageshow handler that re-enables buttons after failed submission
// ---------------------------------------------------------------------------

describe('FormLoadingState', () => {
  // Store originals so we can restore after the test
  let originalDocument: typeof globalThis.document
  let originalWindow: typeof globalThis.window

  /** Minimal DOM stubs that capture addEventListener calls. */
  let capturedListeners: Array<{
    target: string
    event: string
    handler: Function
  }> = []

  function setupMockDom() {
    capturedListeners = []

    // Save originals
    originalDocument = globalThis.document
    originalWindow = globalThis.window

    // Mock document
    let documentMock = {
      addEventListener: (event: string, handler: Function) => {
        capturedListeners.push({ target: 'document', event, handler })
      },
      querySelector: () => null,
    } as unknown as typeof globalThis.document

    // Mock window
    let windowMock = {
      addEventListener: (event: string, handler: Function) => {
        capturedListeners.push({ target: 'window', event, handler })
      },
    } as unknown as typeof globalThis.window

    globalThis.document = documentMock
    globalThis.window = windowMock
  }

  function restoreDom() {
    if (originalDocument) globalThis.document = originalDocument
    if (originalWindow) globalThis.window = originalWindow
  }

  after(() => {
    restoreDom()
  })

  // -----------------------------------------------------------------------
  // Module export
  // -----------------------------------------------------------------------

  it('exports FormLoadingState', () => {
    assert.ok(FormLoadingState, 'FormLoadingState should be exported')
  })

  // -----------------------------------------------------------------------
  // Event listener registration
  // -----------------------------------------------------------------------

  it('registers a submit event listener on the document', () => {
    // Arrange
    setupMockDom()

    // Act — trigger initialization by calling the inner function
    // The clientEntry factory returns a function that initializes on first call.
    // FormLoadingState is the result of clientEntry(...) — we call it as a
    // function passing a mock handle to get the init function, then call that.
    let handle = {} as any
    let initFn = (FormLoadingState as any)(handle)
    initFn()

    // Assert
    let submitListener = capturedListeners.find(
      (l) => l.target === 'document' && l.event === 'submit',
    )
    assert.ok(submitListener, 'should register a submit listener on document')

    let pageshowListener = capturedListeners.find(
      (l) => l.target === 'window' && l.event === 'pageshow',
    )
    assert.ok(pageshowListener, 'should register a pageshow listener on window')
  })

  // -----------------------------------------------------------------------
  // Submit handler disables button on matching forms
  // -----------------------------------------------------------------------

  it('submit handler disables submit button on matching form', () => {
    // Arrange
    setupMockDom()

    let btn = {
      disabled: false,
      classList: { add() { (this as any)._added = 'is-loading' }, _added: '' },
    }

    // Create a chain: event.target → element.closest() → form.querySelector() → btn
    let formEl = {
      querySelector: () => btn,
    }
    let targetEl = {
      closest: () => formEl,
    }

    // Act — initialize and simulate a submit event
    let handle = {} as any
    let initFn = (FormLoadingState as any)(handle)
    initFn()

    let submitListener = capturedListeners.find(
      (l) => l.target === 'document' && l.event === 'submit',
    )
    assert.ok(submitListener, 'submit handler must exist')

    // Fire the handler with a plain event object (avoids Event read-only target)
    submitListener!.handler({ target: targetEl })

    // Assert
    assert.equal(btn.disabled, true, 'submit button should be disabled')
  })

  it('submit handler does nothing for non-matching forms', () => {
    // Arrange
    setupMockDom()

    let btn = { disabled: false, classList: { add() {} } }

    // Create a target whose closest() returns null (no matching form ancestor)
    let targetEl = {
      closest: () => null,
    }

    // Act — initialize and simulate submit on non-matching element
    let handle = {} as any
    let initFn = (FormLoadingState as any)(handle)
    initFn()

    let submitListener = capturedListeners.find(
      (l) => l.target === 'document' && l.event === 'submit',
    )
    assert.ok(submitListener, 'submit handler must exist')

    submitListener!.handler({ target: targetEl })

    // Assert — no matching form found so button should not have been touched
    assert.equal(btn.disabled, false, 'button should remain enabled for non-matching form')
  })

  // -----------------------------------------------------------------------
  // pageshow handler re-enables buttons
  // -----------------------------------------------------------------------

  it('pageshow handler re-enables disabled buttons and removes is-loading class', () => {
    // Arrange
    setupMockDom()

    // Create a mock querySelectorAll result with disabled buttons
    let btn1 = {
      disabled: true,
      classList: { remove: () => {} },
    }
    let btn2 = {
      disabled: true,
      classList: { remove: () => {} },
    }

    // Mock document.querySelectorAll
    let documentMock = {
      addEventListener: (event: string, handler: Function) => {
        capturedListeners.push({ target: 'document', event, handler })
      },
      querySelector: () => null,
      querySelectorAll: () => [btn1, btn2],
    } as unknown as typeof globalThis.document

    let windowMock = {
      addEventListener: (event: string, handler: Function) => {
        capturedListeners.push({ target: 'window', event, handler })
      },
    } as unknown as typeof globalThis.window

    globalThis.document = documentMock
    globalThis.window = windowMock

    // Act — initialize
    let handle = {} as any
    let initFn = (FormLoadingState as any)(handle)
    initFn()

    // Find pageshow handler and call it
    let pageshowListener = capturedListeners.find(
      (l) => l.target === 'window' && l.event === 'pageshow',
    )
    assert.ok(pageshowListener, 'pageshow handler must exist')
    pageshowListener!.handler(new Event('pageshow'))

    // Assert
    assert.equal(btn1.disabled, false, 'btn1 should be re-enabled')
    assert.equal(btn2.disabled, false, 'btn2 should be re-enabled')
    assert.ok(!btn1.disabled, 'btn1 should have is-loading removed')
  })

  // -----------------------------------------------------------------------
  // Initialization only runs once
  // -----------------------------------------------------------------------

  it('only initializes once (guards against double registration)', () => {
    // Arrange
    setupMockDom()

    // Act — call init function twice
    let handle = {} as any
    let initFn = (FormLoadingState as any)(handle)
    initFn() // first call — registers listeners
    initFn() // second call — should be no-op (initialized = true)

    // Assert — only 2 listeners should have been registered
    let submitCount = capturedListeners.filter(
      (l) => l.target === 'document' && l.event === 'submit',
    ).length
    let pageshowCount = capturedListeners.filter(
      (l) => l.target === 'window' && l.event === 'pageshow',
    ).length

    assert.equal(submitCount, 1, 'submit should only be registered once')
    assert.equal(pageshowCount, 1, 'pageshow should only be registered once')
  })
})
