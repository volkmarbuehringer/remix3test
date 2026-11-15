import { describe, it, afterEach } from 'remix/test'
import * as assert from 'remix/assert'

import { fadeOutBody } from './fade-out-body.ts'

let fixture: HTMLElement | null = null

function mountBody(): HTMLElement {
  let body = document.createElement('div')
  body.innerHTML = '<p>content</p>'
  document.body.appendChild(body)
  fixture = body
  return body
}

function matchMedia(matches: boolean) {
  return ((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false
    },
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  fixture?.remove()
  fixture = null
})

describe('fadeOutBody', () => {
  it('skips the WAAPI fade when reduced motion is requested', async (t) => {
    t.mock.method(window, 'matchMedia', matchMedia(true))
    let body = mountBody()

    await fadeOutBody(body)

    assert.equal(body.innerHTML, '', 'the body is cleared without waiting for a fade')
    assert.equal(body.getAnimations().length, 0, 'no WAAPI animation runs under reduced motion')
  })

  it('fades the body out before clearing it', async (t) => {
    t.mock.method(window, 'matchMedia', matchMedia(false))
    let body = mountBody()

    let done = fadeOutBody(body)
    assert.ok(body.getAnimations().length > 0, 'the fade starts a WAAPI animation')
    await done

    assert.equal(body.innerHTML, '')
    assert.equal(body.getAnimations().length, 0, 'the finished animation leaves no residue')
  })
})
