import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { AppointmentsScrollLock } from '../assets/appointments-scroll-lock.tsx'

describe('AppointmentsScrollLock', () => {
  let originalDocument: typeof globalThis.document
  let originalLocation: typeof globalThis.location
  let originalAddEventListener: typeof globalThis.addEventListener
  let documentElementStyle: Record<string, string>
  let capturedEvents: Array<{ event: string; handler: Function; options?: any }>
  let scrollX = 0
  let scrollY = 0
  let abortHandlers: Array<Function>

  function makeHandle() {
    abortHandlers = []
    return {
      signal: {
        addEventListener: (event: string, handler: Function) => {
          if (event === 'abort') abortHandlers.push(handler)
        },
      },
    }
  }

  function triggerAbort() {
    for (let h of abortHandlers) h()
    abortHandlers = []
  }

  function setupDom(search: string) {
    originalDocument = globalThis.document
    originalLocation = globalThis.location
    originalAddEventListener = globalThis.addEventListener

    documentElementStyle = { overflow: '', scrollbarGutter: '' }
    capturedEvents = []
    ;(globalThis as any).location = { search }

    let view = {
      scrollX,
      scrollY,
      scrollTo: (x: number, y: number) => {
        scrollX = x
        scrollY = y
      },
      getComputedStyle: () => ({ scrollbarGutter: 'auto' }),
      innerWidth: 1024,
    }

    ;(globalThis as any).document = {
      body: {},
      defaultView: view,
      documentElement: { style: documentElementStyle, clientWidth: 1000 },
    }

    globalThis.addEventListener = ((event: string, handler: Function, options?: any) => {
      capturedEvents.push({ event, handler, options })
    }) as typeof globalThis.addEventListener
  }

  function restoreDom() {
    ;(globalThis as any).document = originalDocument
    ;(globalThis as any).location = originalLocation
    globalThis.addEventListener = originalAddEventListener
  }

  afterEach(() => {
    restoreDom()
  })

  it('exports AppointmentsScrollLock', () => {
    assert.ok(AppointmentsScrollLock)
  })

  it('locks scroll when URL has editing param', () => {
    setupDom('?editing=42')

    let handle = makeHandle()
    let initFn = (AppointmentsScrollLock as any)(handle)
    initFn()

    assert.equal(documentElementStyle.overflow, 'hidden')
  })

  it('locks scroll when URL has deleting param', () => {
    setupDom('?deleting=7')

    let handle = makeHandle()
    let initFn = (AppointmentsScrollLock as any)(handle)
    initFn()

    assert.equal(documentElementStyle.overflow, 'hidden')
  })

  it('locks scroll when URL has creating=true param', () => {
    setupDom('?creating=true')

    let handle = makeHandle()
    let initFn = (AppointmentsScrollLock as any)(handle)
    initFn()

    assert.equal(documentElementStyle.overflow, 'hidden')
  })

  it('does not lock scroll when no panel param is present', () => {
    setupDom('?sort=title&order=asc')

    let handle = makeHandle()
    let initFn = (AppointmentsScrollLock as any)(handle)
    initFn()

    assert.equal(documentElementStyle.overflow, '')
  })

  it('registers a popstate listener with abort signal', () => {
    setupDom('')

    let handle = makeHandle()
    let initFn = (AppointmentsScrollLock as any)(handle)
    initFn()

    let popstateCall = capturedEvents.find((c) => c.event === 'popstate')
    assert.ok(popstateCall, 'should register popstate listener')
    assert.ok(popstateCall!.options?.signal, 'should pass signal for auto-cleanup')
  })

  it('unlocks and relocks on popstate when panel state changes', () => {
    setupDom('')

    let handle = makeHandle()
    let initFn = (AppointmentsScrollLock as any)(handle)
    initFn()

    assert.equal(documentElementStyle.overflow, '')

    ;(globalThis as any).location = { search: '?editing=1' }
    let popstateHandler = capturedEvents.find((c) => c.event === 'popstate')!
    popstateHandler.handler()

    assert.equal(
      documentElementStyle.overflow,
      'hidden',
      'should lock scroll on popstate with panel param',
    )

    ;(globalThis as any).location = { search: '' }
    popstateHandler.handler()

    assert.equal(
      documentElementStyle.overflow,
      '',
      'should unlock scroll on popstate without panel param',
    )
  })

  it('initializes only once', () => {
    setupDom('?editing=1')

    let handle = makeHandle()
    let initFn = (AppointmentsScrollLock as any)(handle)
    initFn()

    documentElementStyle.overflow = ''
    initFn()

    assert.equal(documentElementStyle.overflow, '', 'second init should not re-lock')
  })

  it('unlocks scroll on abort (unmount)', () => {
    setupDom('?editing=1')

    let handle = makeHandle()
    let initFn = (AppointmentsScrollLock as any)(handle)
    initFn()

    assert.equal(documentElementStyle.overflow, 'hidden', 'should be locked after init')

    triggerAbort()

    assert.equal(documentElementStyle.overflow, '', 'should unlock scroll on abort')
  })
})
