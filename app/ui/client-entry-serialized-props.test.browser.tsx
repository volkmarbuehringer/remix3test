import { afterEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import {
  clientEntry,
  css,
  run,
  type AppRuntime,
  type Handle,
  type RemixNode,
} from 'remix/component'
import { renderToString } from 'remix/component/server'

// ---------------------------------------------------------------------------
// Client-entry props cross the SSR boundary as JSON. Since remix #12125,
// elements carried in `children`/`fallback` may contain css() mixins (including
// mix arrays), and hydration must restore their styles. on()/ref()/custom
// mixins are deliberately not serializable, so this guard stays limited to the
// supported element+mixin path the app uses in client-entry slots.
// ---------------------------------------------------------------------------

interface StyledSlotProps {
  children?: RemixNode
  fallback?: RemixNode
}

const StyledSlotEntry = clientEntry(
  '/assets/styled-slot-hydration.js#StyledSlotEntry',
  function StyledSlotEntry(handle: Handle<StyledSlotProps>) {
    return () => (
      <section data-styled-slot-entry>
        <div id="children-slot">{handle.props.children}</div>
        <div id="fallback-slot">{handle.props.fallback}</div>
      </section>
    )
  },
)

let runtime: AppRuntime | null = null

afterEach(() => {
  runtime?.dispose()
  runtime = null
  document.body.replaceChildren()
  for (let style of document.head.querySelectorAll('style[data-rmx-style]')) style.remove()
})

/** Install the server document and keep client-entry styles in <head>. */
function installServerHtml(html: string) {
  let parsed = new DOMParser().parseFromString(html, 'text/html')

  for (let node of Array.from(parsed.documentElement.childNodes)) {
    if (node instanceof HTMLHeadElement) {
      for (let child of Array.from(node.childNodes)) {
        if (child instanceof HTMLStyleElement) document.head.append(child)
        else document.body.append(child)
      }
    } else if (node instanceof HTMLBodyElement) {
      document.body.append(...Array.from(node.childNodes))
    } else {
      document.body.append(node)
    }
  }
}

describe('client-entry serialized props', () => {
  it('hydrates css() mixins in children and fallback elements', async () => {
    let html = await renderToString(
      <StyledSlotEntry
        fallback={
          <div id="styled-fallback" mix={css({ color: 'rgb(10, 20, 30)' })}>
            fallback
          </div>
        }
      >
        <div
          id="styled-placeholder"
          mix={[css({ color: 'rgb(1, 2, 3)' }), css({ fontWeight: 700 })]}
        >
          placeholder
        </div>
      </StyledSlotEntry>,
    )
    installServerHtml(html)

    runtime = run({
      loadModule(moduleUrl, exportName) {
        if (moduleUrl === '/assets/styled-slot-hydration.js' && exportName === 'StyledSlotEntry') {
          return StyledSlotEntry
        }
        throw new Error(`Unexpected client entry module: ${moduleUrl}#${exportName}`)
      },
    })
    await runtime.ready()
    runtime.flush()

    let placeholder = document.querySelector<HTMLElement>('#styled-placeholder')
    assert.ok(placeholder, 'the serialized children element must hydrate')
    let placeholderStyle = getComputedStyle(placeholder)
    assert.equal(placeholderStyle.color, 'rgb(1, 2, 3)')
    assert.equal(placeholderStyle.fontWeight, '700')

    let fallback = document.querySelector<HTMLElement>('#styled-fallback')
    assert.ok(fallback, 'the serialized fallback element must hydrate')
    assert.equal(getComputedStyle(fallback).color, 'rgb(10, 20, 30)')
  })
})
