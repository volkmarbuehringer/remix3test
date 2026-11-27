import * as assert from 'remix/assert'
import { createRoot } from 'remix/component'
import * as dialog from '@remix-run/ui/dialog'
import { afterEach, describe, it } from 'remix/test'

// Regression guard for remix #12462 (pin `56522c2e`): when a focus guard
// redirects focus inside an overflowing dialog, Firefox could replay a stale
// scroll after `focus()` and leave the redirected control out of view. The
// vendor now scrolls the redirected target explicitly. `ConfirmDelete` is the
// app's one `@remix-run/ui/dialog`, so this pins the primitive the shell
// depends on rather than a one-off copy of its markup.

function GuardDialog() {
  return () => (
    <dialog.Context open>
      <dialog.Portal>
        <dialog.SurfaceContext>
          <div
            data-testid="dialog"
            style={{ height: '120px', overflow: 'auto' }}
            mix={dialog.surface()}
          >
            <input id="scope-start" aria-label="First" />
            <button id="scope-middle">Middle</button>
            <input
              id="scope-end"
              aria-label="Last"
              style={{ display: 'block', marginTop: '600px' }}
            />
          </div>
        </dialog.SurfaceContext>
      </dialog.Portal>
    </dialog.Context>
  )
}

let root: ReturnType<typeof createRoot> | null = null

afterEach(() => {
  root?.dispose()
  root = null
  document.body.replaceChildren()
  for (let guard of document.querySelectorAll('[data-rmx-focus-guard]')) guard.remove()
})

describe('dialog focus guards', () => {
  it('keeps guard-redirected focus visible in an overflowing dialog', async () => {
    let host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
    root.render(<GuardDialog />)
    root.flush()

    let surface = document.querySelector<HTMLElement>('[data-testid="dialog"]')
    let first = document.querySelector<HTMLInputElement>('#scope-start')
    let last = document.querySelector<HTMLInputElement>('#scope-end')
    let guards = Array.from(
      document.querySelectorAll<HTMLElement>('[data-rmx-focus-guard][tabindex="0"]'),
    )
    assert.ok(surface && first && last, 'the dialog surface and controls render')
    assert.equal(guards.length, 2, 'the surface renders leading and trailing active focus guards')

    let before = guards[0]!
    let after = guards[1]!
    assert.ok(
      surface.scrollHeight > surface.clientHeight,
      'the dialog surface is the overflowing scroll container',
    )

    // Leading guard with focus just before it redirects backwards to the last control.
    first.focus()
    before.focus()
    assert.equal(document.activeElement, last, 'the leading guard redirects to the last control')
    assert.ok(surface.scrollTop > 0, 'the redirect scrolls the overflow container')
    assert.ok(
      last.getBoundingClientRect().bottom <= surface.getBoundingClientRect().bottom + 1,
      'the last control is visible after the redirect',
    )

    // Trailing guard with focus just after it redirects forwards to the first control.
    after.focus()
    assert.equal(document.activeElement, first, 'the trailing guard redirects to the first control')
    // Firefox could replay a stale scroll on the next reflow, so check after layout settles.
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    let surfaceRect = surface.getBoundingClientRect()
    assert.ok(
      first.getBoundingClientRect().top >= surfaceRect.top - 1,
      'the redirected first control is not scrolled out of view',
    )
    assert.ok(
      first.getBoundingClientRect().bottom <= surfaceRect.bottom + 1,
      'the redirected first control is fully visible',
    )
  })
})
