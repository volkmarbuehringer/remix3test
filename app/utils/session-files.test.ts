import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import * as assert from 'remix/assert'
import { describe, it } from 'remix/test'

import {
  DEFAULT_SESSION_RETENTION_MS,
  pruneSessionFiles,
  resolveSessionDirectory,
} from './session-files.ts'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

describe('resolveSessionDirectory', () => {
  it('uses an absolute SESSION_DIR as-is', () => {
    assert.equal(resolveSessionDirectory('/var/lib/sessions', '/fallback'), '/var/lib/sessions')
  })

  it('resolves a relative SESSION_DIR against the working directory', () => {
    assert.equal(
      resolveSessionDirectory('./var/sessions', '/fallback'),
      path.resolve('./var/sessions'),
    )
  })

  it('falls back when SESSION_DIR is unset or blank', () => {
    assert.equal(resolveSessionDirectory(undefined, '/fallback'), '/fallback')
    assert.equal(resolveSessionDirectory('   ', '/fallback'), '/fallback')
  })
})

describe('pruneSessionFiles', () => {
  it('removes abandoned sessions and crash-leftover temp files only', async () => {
    let directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'session-prune-'))
    let now = Date.now()

    try {
      let subdir = path.join(directory, 'ab')
      await fsp.mkdir(subdir)

      let stale = path.join(subdir, 'a'.repeat(62))
      let fresh = path.join(subdir, 'b'.repeat(62))
      let staleTemp = path.join(subdir, `${'c'.repeat(62)}.deadbeef.tmp`)
      let freshTemp = path.join(subdir, `${'d'.repeat(62)}.cafebabe.tmp`)
      let unrelated = path.join(subdir, 'keep.txt')

      for (let file of [stale, fresh, staleTemp, freshTemp, unrelated]) {
        await fsp.writeFile(file, 'x')
      }

      let staleTime = new Date(now - DEFAULT_SESSION_RETENTION_MS - DAY_MS)
      await fsp.utimes(stale, staleTime, staleTime)
      await fsp.utimes(unrelated, staleTime, staleTime)
      let staleTempTime = new Date(now - 2 * HOUR_MS)
      await fsp.utimes(staleTemp, staleTempTime, staleTempTime)

      let result = await pruneSessionFiles(directory, { now })

      assert.deepEqual(result, { sessions: 1, temporary: 1 })
      assert.equal(await exists(stale), false, 'abandoned session file is removed')
      assert.equal(await exists(staleTemp), false, 'stale temp file is removed')
      assert.equal(await exists(fresh), true, 'fresh session file is kept')
      assert.equal(await exists(freshTemp), true, 'fresh temp file is kept')
      assert.equal(await exists(unrelated), true, 'unrelated files are never touched')
    } finally {
      await fsp.rm(directory, { recursive: true, force: true })
    }
  })

  it('ignores a missing directory', async () => {
    let directory = path.join(os.tmpdir(), `session-prune-missing-${crypto.randomUUID()}`)
    assert.deepEqual(await pruneSessionFiles(directory), { sessions: 0, temporary: 0 })
  })
})

async function exists(file: string): Promise<boolean> {
  try {
    await fsp.stat(file)
    return true
  } catch {
    return false
  }
}
