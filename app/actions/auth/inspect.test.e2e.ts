import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { router } from '../../test-router.ts'
import { routes } from '../../routes.ts'
import { createCsrfSession } from '../../test-utils.ts'

const BASE = 'https://remix.run'

describe('register form inspection', () => {
  it('renders password fields with toggle and shows field errors on validation failure', async () => {
    // GET: initial load
    let getRes = await router.fetch(`${BASE}${routes.auth.register.index.href()}`)
    let getHtml = await getRes.text()

    assert.ok(getHtml.includes('type="password"'), 'should have password type inputs')
    assert.ok(getHtml.includes('data-toggle-pw'), 'should have toggle buttons')
    assert.ok(getHtml.includes('name="confirmPassword"'), 'should have confirm password field')

    // POST: trigger validation errors
    let { cookie, csrfToken } = await createCsrfSession(
      `${BASE}${routes.auth.register.index.href()}`,
    )
    let postRes = await router.fetch(`${BASE}${routes.auth.register.action.href()}`, {
      method: 'POST',
      body: new URLSearchParams({
        name: 'X',
        email: 'bad',
        password: 'sh',
        confirmPassword: 'sh',
        _csrf: csrfToken,
      }),
      headers: { Cookie: cookie },
    })
    let postHtml = await postRes.text()

    assert.equal(postRes.status, 400)
    assert.ok(postHtml.includes('<span id="name-error"'), 'should have name field error span')
    assert.ok(postHtml.includes('<span id="email-error"'), 'should have email field error span')
    assert.ok(
      postHtml.includes('<span id="password-error"'),
      'should have password field error span',
    )
    assert.ok(
      postHtml.includes('<span id="confirm-password-error"'),
      'should have confirm-password field error span',
    )
    assert.ok(postHtml.includes('Expected valid email'), 'should show email error message')
    assert.ok(postHtml.includes('Expected at least 10'), 'should show password error message')
    assert.ok(!postHtml.includes('defaultValue='), 'should not leak formValues as defaultValue')
  })
})
