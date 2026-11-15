import * as assert from 'remix/assert'
import { createCookie } from 'remix/cookie'
import { SetCookie } from 'remix/headers'
import { describe, it } from 'remix/test'

import { sessionSecrets } from './session-secrets.ts'

describe('sessionSecrets', () => {
  it('puts the current secret first and keeps retired secrets after it', () => {
    assert.deepEqual(sessionSecrets('new', 'old1, old2'), ['new', 'old1', 'old2'])
  })

  it('accepts a single previous secret', () => {
    assert.deepEqual(sessionSecrets('new', 'old'), ['new', 'old'])
  })

  it('drops blank entries, duplicates, and the current secret', () => {
    assert.deepEqual(sessionSecrets('new', ' old , , new, old ,  '), ['new', 'old'])
  })

  it('returns only the current secret when no previous list is configured', () => {
    assert.deepEqual(sessionSecrets('new', undefined), ['new'])
    assert.deepEqual(sessionSecrets('new', '   '), ['new'])
  })

  it('verifies a cookie signed by a retired secret and signs new ones with the current secret', async () => {
    let beforeRotation = createCookie('session', { secrets: ['old-secret'] })
    let afterRotation = createCookie('session', {
      secrets: sessionSecrets('new-secret', 'old-secret'),
    })
    let afterRetirement = createCookie('session', { secrets: ['new-secret'] })

    let oldCookie = await beforeRotation.serialize('session-id-from-before')
    assert.equal(
      await afterRotation.parse(cookieHeader(oldCookie)),
      'session-id-from-before',
      'a live cookie must survive one rotation step',
    )

    let newCookie = await afterRotation.serialize('session-id-after')
    assert.equal(
      await afterRetirement.parse(cookieHeader(newCookie)),
      'session-id-after',
      'new cookies must be signed with the current secret only',
    )
    assert.equal(
      await afterRetirement.parse(cookieHeader(oldCookie)),
      null,
      'dropping the retired secret must invalidate cookies signed with it',
    )
  })
})

/** Turn a `Set-Cookie` value into the request `Cookie` header `parse()` expects. */
function cookieHeader(setCookie: string): string {
  let parsed = SetCookie.from(setCookie)
  return `${parsed.name}=${parsed.value}`
}
