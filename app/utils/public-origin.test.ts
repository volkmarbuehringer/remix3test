import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
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

/** Create a throwaway origin file so each test gets an uncached path. */
function makeOriginFile(contents: string): { dir: string; file: string } {
  let dir = fs.mkdtempSync(path.join(os.tmpdir(), 'public-origin-'))
  let file = path.join(dir, 'origin')
  fs.writeFileSync(file, contents)
  return { dir, file }
}

const MISSING_FILE = path.join(os.tmpdir(), 'public-origin-does-not-exist')

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

  it('reads the current origin from PUBLIC_ORIGIN_FILE when the env var is unset', () => {
    let { dir, file } = makeOriginFile('https://random-words.trycloudflare.com\n')
    try {
      withEnv({ PUBLIC_ORIGIN: undefined, PUBLIC_ORIGIN_FILE: file }, () => {
        assert.equal(
          getPublicOrigin('https://attacker.example'),
          'https://random-words.trycloudflare.com',
        )
      })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prefers PUBLIC_ORIGIN over the file', () => {
    let { dir, file } = makeOriginFile('https://from-file.example')
    try {
      withEnv({ PUBLIC_ORIGIN: 'https://from-env.example', PUBLIC_ORIGIN_FILE: file }, () => {
        assert.equal(getPublicOrigin('https://attacker.example'), 'https://from-env.example')
      })
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('falls back to the request origin outside production when neither is present', () => {
    withEnv(
      {
        PUBLIC_ORIGIN: undefined,
        PUBLIC_ORIGIN_FILE: MISSING_FILE,
        NODE_ENV: 'development',
      },
      () => {
        assert.equal(getPublicOrigin('http://localhost:44100'), 'http://localhost:44100')
      },
    )
  })

  it('throws in production when neither PUBLIC_ORIGIN nor the file is present', () => {
    withEnv(
      {
        PUBLIC_ORIGIN: undefined,
        PUBLIC_ORIGIN_FILE: MISSING_FILE,
        NODE_ENV: 'production',
      },
      () => {
        assert.throws(() => getPublicOrigin('https://attacker.example'))
      },
    )
  })
})
