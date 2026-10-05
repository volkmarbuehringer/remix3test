import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { render } from 'remix/component/test'
import type { RemixNode } from 'remix/component'

import { ErrorCard } from './error-card.browser.tsx'

// ---------------------------------------------------------------------------
// ErrorCard — the bounded failure surface of the frame runtime.
//
// resolveFrameResponse renders a 5xx frame failure as this card (see
// frame-response.browser.tsx and the frame-failures reference); until now the
// card itself had no direct coverage — frame-response.test.browser.ts only
// exercises the resolver. renderFatalError is deliberately NOT tested: its
// only unique behavior is a window.location.reload button, which is
// unforgeable in a real browser.
// ---------------------------------------------------------------------------

let cleanup: (() => void) | null = null

function mount(props: {
  eyebrow: string
  title: string
  message: string
  animated?: boolean
  action?: RemixNode
}) {
  let result = render(
    <ErrorCard
      eyebrow={props.eyebrow}
      title={props.title}
      message={props.message}
      {...(props.animated !== undefined ? { animated: props.animated } : {})}
      {...(props.action !== undefined ? { action: props.action } : {})}
    />,
  )
  cleanup = result.cleanup
  return result
}

afterEach(() => {
  cleanup?.()
  cleanup = null
})

describe('ErrorCard', () => {
  it('renders the eyebrow, title, and message the runtime supplies', () => {
    let { container } = mount({
      eyebrow: 'Frame Error',
      title: 'Etwas ist schiefgelaufen',
      message: 'Der Abschnitt konnte nicht geladen werden.',
    })

    assert.equal(container.querySelector('p')?.textContent, 'Frame Error')
    assert.equal(container.querySelector('h1')?.textContent, 'Etwas ist schiefgelaufen')
    assert.ok(
      [...container.querySelectorAll('p')].some((p) =>
        p.textContent?.includes('nicht geladen werden'),
      ),
    )
  })

  it('renders the action node inside the card', () => {
    let { container } = mount({
      eyebrow: 'Frame Error',
      title: 'T',
      message: 'M',
      action: <button type="button">Erneut versuchen</button>,
    })

    let action = container.querySelector('button')
    assert.ok(action, 'the action slot must render')
    assert.equal(action.textContent?.trim(), 'Erneut versuchen')
    assert.equal(
      container.querySelector('h1')?.contains(action!),
      false,
      'the action sits in the card, not the heading',
    )
  })

  it('omits the action slot entirely when none is supplied', () => {
    let { container } = mount({ eyebrow: 'E', title: 'T', message: 'M' })

    assert.equal(container.querySelector('button'), null)
    assert.equal(container.querySelector('a'), null)
  })

  it('the animated variant mounts and lands fully visible', async () => {
    let { container } = mount({
      eyebrow: 'Fatal',
      title: 'Something went wrong',
      message: 'Render crashed.',
      animated: true,
    })

    let card = container.querySelector('div')
    assert.ok(card, 'animated card mounts')

    // entrance() collapses to a no-op under reduced motion; the spring lands
    // within ~500ms otherwise — either way the card ends fully visible.
    await new Promise((resolve) => setTimeout(resolve, 900))
    let opacity = Number.parseFloat(getComputedStyle(card).opacity)
    assert.ok(opacity > 0.98, `entrance animation must settle at full opacity, got ${opacity}`)
  })

  it('the non-animated variant is visible immediately', () => {
    let { container } = mount({ eyebrow: 'E', title: 'T', message: 'M', animated: false })

    let opacity = Number.parseFloat(getComputedStyle(container.querySelector('div')!).opacity)
    assert.equal(opacity, 1)
  })
})
