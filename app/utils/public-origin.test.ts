import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { getPublicOrigin } from './public-origin.ts'

/** Run `fn` with the given env vars temporarily applied, restoring afterwards. */
function withEnv(values: Record<string, string | undefined>, fn: () => void): void {
  let saved: Record<string, string | undefined> = {}
  for (let key of Object.keys(values)) {
    saved[key] = process.env[key]
    let value = values[key]
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  try {
    fn()
  } finally {
    for (let [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
}

describe('getPublicOrigin', () => {
  it('returns the configured PUBLIC_ORIGIN and strips trailing slashes', () => {
    withEnv({ PUBLIC_ORIGIN: 'https://app.example.com///' }, () => {
      assert.equal(getPublicOrigin('https://attacker.example'), 'https://app.example.com')
    })
  })

  it('ignores the request origin when PUBLIC_ORIGIN is configured (poisoned Host)', () => {
    withEnv({ PUBLIC_ORIGIN: 'https://app.example.com' }, () => {
      assert.equal(getPublicOrigin('http://evil.trycloudflare.com'), 'https://app.example.com')
    })
  })

  it('falls back to the request origin outside production when unset', () => {
    withEnv({ PUBLIC_ORIGIN: undefined, NODE_ENV: 'development' }, () => {
      assert.equal(getPublicOrigin('http://localhost:44100'), 'http://localhost:44100')
    })
  })

  it('throws in production when PUBLIC_ORIGIN is unset', () => {
    withEnv({ PUBLIC_ORIGIN: undefined, NODE_ENV: 'production' }, () => {
      assert.throws(() => getPublicOrigin('https://attacker.example'))
    })
  })
})
