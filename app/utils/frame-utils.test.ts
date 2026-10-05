import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { frames } from '../routes.ts'
import { activeFrameName, activeFrameNameOrNull, safeNavigate } from './frame-utils.ts'

type FakeFrame = {
  src?: string
  reloadCalled: number
  reload: () => Promise<void>
}

/**
 * Installs a `document` whose only element is the support-agent container
 * declaring `data-active-frame` (absent/`null` = no container), plus a writable
 * fake `window.location`. Returns the location stub and a restore function.
 */
function withPanelContainer(activeFrame: string | null): {
  location: { href: string }
  restore: () => void
} {
  let originalDocument = globalThis.document
  let originalWindow = globalThis.window
  let location = { href: '' }
  globalThis.document = {
    getElementById: (id: string) =>
      id === 'support-agent-frame-container' && activeFrame != null
        ? { getAttribute: (name: string) => (name === 'data-active-frame' ? activeFrame : null) }
        : null,
  } as unknown as typeof globalThis.document
  globalThis.window = { location } as unknown as typeof globalThis.window
  return {
    location,
    restore() {
      globalThis.document = originalDocument
      globalThis.window = originalWindow
    },
  }
}

function fakeHandle(frame: FakeFrame | null): never {
  return { frames: { get: () => frame } } as never
}

function flush(): Promise<void> {
  // Let the reload promise's .then/.catch microtasks settle.
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('activeFrameName / activeFrameNameOrNull', () => {
  it('reads the container data-active-frame attribute', () => {
    let env = withPanelContainer(frames.supportAgentPanel)
    try {
      assert.equal(activeFrameNameOrNull('support-agent-frame-container'), 'support-agent-panel')
      assert.equal(
        activeFrameName('support-agent-frame-container', 'fallback-frame'),
        'support-agent-panel',
      )
    } finally {
      env.restore()
    }
  })

  it('returns null (or the fallback) when the container or its attribute is absent', () => {
    let env = withPanelContainer(null)
    try {
      assert.equal(activeFrameNameOrNull('support-agent-frame-container'), null)
      assert.equal(
        activeFrameName('support-agent-frame-container', 'fallback-frame'),
        'fallback-frame',
      )
    } finally {
      env.restore()
    }
  })
})

describe('safeNavigate', () => {
  it('reloads the addressable frame and leaves window.location untouched', async () => {
    let env = withPanelContainer(frames.supportAgentPanel)
    let reloaded: string[] = []
    let frame: FakeFrame = {
      reloadCalled: 0,
      reload() {
        frame.reloadCalled++
        reloaded.push(this.src ?? '')
        return Promise.resolve()
      },
    }
    try {
      safeNavigate('/x?editing=1', fakeHandle(frame))
      assert.equal(frame.reloadCalled, 1)
      assert.equal(frame.src, '/x?editing=1')
      await flush()
      assert.deepEqual(reloaded, ['/x?editing=1'])
      assert.equal(env.location.href, '')
    } finally {
      env.restore()
    }
  })

  it('falls back to a full-page navigation when no frame is addressable', () => {
    let env = withPanelContainer(null)
    let frame: FakeFrame = { reloadCalled: 0, reload: () => Promise.resolve() }
    try {
      safeNavigate('/x?editing=1', fakeHandle(frame))
      assert.equal(frame.reloadCalled, 0)
      assert.equal(env.location.href, '/x?editing=1')
    } finally {
      env.restore()
    }
  })

  it('falls back to a full-page navigation when the frame is unregistered', () => {
    let env = withPanelContainer(frames.supportAgentPanel)
    try {
      safeNavigate('/x?editing=1', fakeHandle(null))
      assert.equal(env.location.href, '/x?editing=1')
    } finally {
      env.restore()
    }
  })

  it('falls back to a full-page navigation when reload rejects', async () => {
    let env = withPanelContainer(frames.supportAgentPanel)
    let frame: FakeFrame = {
      reloadCalled: 0,
      reload() {
        frame.reloadCalled++
        return Promise.reject(new Error('frame gone'))
      },
    }
    try {
      safeNavigate('/x?editing=1', fakeHandle(frame))
      assert.equal(env.location.href, '')
      await flush()
      assert.equal(frame.reloadCalled, 1)
      assert.equal(env.location.href, '/x?editing=1')
    } finally {
      env.restore()
    }
  })

  it('keeps the in-frame navigation when reload resolves', async () => {
    let env = withPanelContainer(frames.supportAgentPanel)
    let frame: FakeFrame = {
      reloadCalled: 0,
      reload() {
        frame.reloadCalled++
        return Promise.resolve()
      },
    }
    try {
      safeNavigate('/x?editing=1', fakeHandle(frame))
      await flush()
      assert.equal(frame.reloadCalled, 1)
      assert.equal(env.location.href, '')
    } finally {
      env.restore()
    }
  })
})
