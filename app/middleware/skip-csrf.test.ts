import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { isAllowedCsrfOrigin } from './skip-csrf.ts'

const MISSING_FILE = '/nonexistent/public-origin-for-csrf-test'

function ctx(origin: string, fetchSite: string) {
  let headers = new Headers()
  headers.set('Origin', origin)
  headers.set('Sec-Fetch-Site', fetchSite)
  return {
    url: new URL('http://localhost:44100/'),
    request: new Request('http://localhost:44100/', { headers }),
  }
}

/** Ensure no trusted origin is configured for the duration of `fn`. */
function withNoConfiguredOrigin(fn: () => void): void {
  let savedOrigin = process.env.PUBLIC_ORIGIN
  let savedFile = process.env.PUBLIC_ORIGIN_FILE
  delete process.env.PUBLIC_ORIGIN
  process.env.PUBLIC_ORIGIN_FILE = MISSING_FILE
  try {
    fn()
  } finally {
    if (savedOrigin === undefined) delete process.env.PUBLIC_ORIGIN
    else process.env.PUBLIC_ORIGIN = savedOrigin
    if (savedFile === undefined) delete process.env.PUBLIC_ORIGIN_FILE
    else process.env.PUBLIC_ORIGIN_FILE = savedFile
  }
}

describe('isAllowedCsrfOrigin', () => {
  it('allows the request origin', () => {
    withNoConfiguredOrigin(() => {
      assert.equal(
        isAllowedCsrfOrigin('http://localhost:44100', ctx('http://localhost:44100', 'same-origin')),
        true,
      )
    })
  })

  it('allows the configured trusted origin even when Host is rewritten', () => {
    let saved = process.env.PUBLIC_ORIGIN
    process.env.PUBLIC_ORIGIN = 'https://random-words.trycloudflare.com'
    try {
      assert.equal(
        isAllowedCsrfOrigin(
          'https://random-words.trycloudflare.com',
          ctx('https://random-words.trycloudflare.com', 'same-origin'),
        ),
        true,
      )
    } finally {
      if (saved === undefined) delete process.env.PUBLIC_ORIGIN
      else process.env.PUBLIC_ORIGIN = saved
    }
  })

  it('rejects a cross-site attacker tunnel origin', () => {
    withNoConfiguredOrigin(() => {
      assert.equal(
        isAllowedCsrfOrigin(
          'https://evil.trycloudflare.com',
          ctx('https://evil.trycloudflare.com', 'cross-site'),
        ),
        false,
      )
    })
  })

  it('rejects a same-site (different tunnel) origin', () => {
    withNoConfiguredOrigin(() => {
      assert.equal(
        isAllowedCsrfOrigin(
          'https://other.trycloudflare.com',
          ctx('https://other.trycloudflare.com', 'same-site'),
        ),
        false,
      )
    })
  })

  it('allows a same-origin tunnel browser request', () => {
    withNoConfiguredOrigin(() => {
      assert.equal(
        isAllowedCsrfOrigin(
          'https://app.trycloudflare.com',
          ctx('https://app.trycloudflare.com', 'same-origin'),
        ),
        true,
      )
    })
  })

  it('rejects an unrelated origin', () => {
    withNoConfiguredOrigin(() => {
      assert.equal(
        isAllowedCsrfOrigin('https://evil.example', ctx('https://evil.example', 'cross-site')),
        false,
      )
    })
  })
})
