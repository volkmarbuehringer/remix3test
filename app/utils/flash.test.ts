import * as fs from 'node:fs'
import * as path from 'node:path'

import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { FLASH_KEYS, flash, flashError, flashSuccess, readFlash, type FlashTone } from './flash.ts'

// ---------------------------------------------------------------------------
// Flash vocabulary
//
// `FLASH_KEYS` is the single source of truth: `mergeSessionWrites` gets the
// list (an unknown key is silently dropped on a concurrent save) and the banner
// reads the same tones. The source guard below keeps future writes on the typed
// helpers instead of a bare `session.flash('…', …)` at the call site.
// ---------------------------------------------------------------------------

function fakeSession(initial: Record<string, unknown> = {}) {
  let values = new Map(Object.entries(initial))
  let writes: Array<{ key: FlashTone; value: string }> = []
  return {
    values,
    writes,
    flash(key: FlashTone, value: string) {
      writes.push({ key, value })
    },
    get(key: string) {
      return values.get(key)
    },
  }
}

describe('flash helpers', () => {
  it('exposes exactly the tones the banner and the session merge know', () => {
    assert.deepEqual([...FLASH_KEYS], ['error', 'success'])
  })

  it('writes the typed tone', () => {
    let session = fakeSession()
    flashError(session, 'kaputt')
    flashSuccess(session, 'gespeichert')
    flash(session, 'error', 'nochmal')

    assert.deepEqual(session.writes, [
      { key: 'error', value: 'kaputt' },
      { key: 'success', value: 'gespeichert' },
      { key: 'error', value: 'nochmal' },
    ])
  })

  it('no-ops when the route has no session', () => {
    assert.doesNotThrow(() => {
      flashError(null, 'kaputt')
      flashSuccess(undefined, 'gespeichert')
      flash(null, 'error', 'kaputt')
    })
  })

  it('reads only string values for the known tones', () => {
    let state = readFlash(
      fakeSession({
        error: 'kaputt',
        success: 42,
        notice: 'ignored',
      }),
    )

    assert.deepEqual(state, { error: 'kaputt' })
  })

  it('returns an empty state without a session or pending values', () => {
    assert.deepEqual(readFlash(null), {})
    assert.deepEqual(readFlash(fakeSession()), {})
  })
})

// ---------------------------------------------------------------------------
// Source guard
// ---------------------------------------------------------------------------

const APP_ROOT = path.resolve(import.meta.dirname, '..')
const FLASH_MODULE = path.join(APP_ROOT, 'utils', 'flash.ts')
// The merge layer re-applies flash values on a merged session (`merged.flash`),
// and its comment quotes the Session API; it is not a write site.
const MERGE_MODULE = path.join(APP_ROOT, 'utils', 'session-storage-merge.ts')

function productionFiles(dir: string): string[] {
  let files: string[] = []
  for (let entry of fs.readdirSync(dir, { withFileTypes: true })) {
    let full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...productionFiles(full))
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
      files.push(full)
    }
  }
  return files
}

describe('flash writes', () => {
  it('go through the typed helpers, not a bare session.flash() call', () => {
    let offenders = productionFiles(APP_ROOT)
      .filter((file) => file !== FLASH_MODULE && file !== MERGE_MODULE)
      .flatMap((file) => {
        let lines = fs.readFileSync(file, 'utf8').split('\n')
        return lines.flatMap((line, index) =>
          line.includes('.flash(') ? [`${path.relative(APP_ROOT, file)}:${index + 1}`] : [],
        )
      })

    assert.deepEqual(
      offenders,
      [],
      'write flashes with flash/flashError/flashSuccess from app/utils/flash.ts',
    )
  })
})
