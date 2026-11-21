import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { router } from '../test-router.ts'

const BASE = 'https://remix.run'

describe('uploadFormData malformed multipart handling', () => {
  it('returns a localized 400 for a raw malformed multipart body', async () => {
    let rawBody =
      '--broken\r\n' +
      'Content-Disposition: form-data; name="email"\r\n' +
      '\r\n' +
      'user@example.com\r\n'

    let response = await router.fetch(`${BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=broken' },
      body: rawBody,
    })

    assert.equal(response.status, 400, 'a malformed multipart body must not become a 500')
    assert.match(response.headers.get('Content-Type') ?? '', /text\/html/)
    let html = await response.text()
    assert.ok(
      html.includes('Ungültige Formulardaten'),
      'the 400 response must carry a localized error message',
    )
  })
})
