import { describe, it, before } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../../test-router.ts'
import { extractCookie } from '../../../test/utils.ts'
import { routes } from '../../routes.ts'
import { initializeAppDatabase } from '../../db.ts'
import { pool } from '../../../test/pool.ts'

const BASE = 'https://remix.run'
const TEST_PREFIX = `verify-${Date.now()}-`

describe('Auth verify controller', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  it('verifies the email and renders the message once on the login page', async () => {
    let email = `${TEST_PREFIX}user@example.com`
    let token = 'verify-token-' + Date.now()
    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, email_verified, verification_token, verification_expires, created_at)
       VALUES ($1, $2, $3, $4, 0, $5, $6, $7)`,
      [
        email,
        'hashed-password-for-testing',
        'Verify User',
        'customer',
        token,
        Date.now() + 3_600_000,
        Date.now(),
      ],
    )

    let response = await router.fetch(`${BASE}${routes.auth.verify.href({ token })}`, {
      redirect: 'manual',
    })
    assert.equal(response.status, 302)
    assert.equal(response.headers.get('Location'), routes.auth.login.index.href())

    let row = await pool.query(
      'SELECT email_verified, verification_token FROM users WHERE email = $1',
      [email],
    )
    assert.equal(row.rows[0].email_verified, 1, 'the token should verify the address')
    assert.equal(row.rows[0].verification_token, null, 'the token should be consumed')

    // Guide 09 §"Redirect after saving": the message is flashed before the
    // redirect and consumed by the destination page's FlashBanner.
    let cookie = extractCookie(response)
    let login = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      headers: { Cookie: cookie },
    })
    assert.equal(login.status, 200)
    let loginHtml = await login.text()
    assert.ok(
      loginHtml.includes('Email verified successfully! Please log in.'),
      'the login page should render the one-shot verification message',
    )

    let loginAgain = await router.fetch(`${BASE}${routes.auth.login.index.href()}`, {
      headers: { Cookie: cookie },
    })
    assert.ok(
      !(await loginAgain.text()).includes('Email verified successfully!'),
      'the flash must be consumed after one render',
    )
  })

  it('rejects an unknown token with a 400 error page', async () => {
    let response = await router.fetch(
      `${BASE}${routes.auth.verify.href({ token: 'unknown-' + Date.now() })}`,
    )
    assert.equal(response.status, 400)
    assert.ok((await response.text()).includes('Invalid verification link'))
  })
})
