import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

import { afterEach, before, beforeEach, describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { createFsFileStorage } from 'remix/file-storage/fs'

import { db, initializeAppDatabase } from '../db.ts'
import { pool } from '../../test/pool.ts'
import { insertUploadFile, listUploadFiles } from './upload-files.ts'
import { sweepOrphanedUploadFiles } from './upload-files-sweep.ts'

const TEST_FILE_PREFIX = 'uplsweep-'
const HOUR_MS = 60 * 60 * 1000

let directory: string
let storage: ReturnType<typeof createFsFileStorage>

function testFile(name: string, content = 'sweep fixture'): File {
  return new File([content], `${TEST_FILE_PREFIX}${name}.txt`, { type: 'text/plain' })
}

async function hashOf(key: string): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key))
  return Buffer.from(digest).toString('hex')
}

async function pathsFor(key: string) {
  let hash = await hashOf(key)
  let hashDirectory = path.join(directory, hash.slice(0, 2))
  return {
    hash,
    directory: hashDirectory,
    data: path.join(hashDirectory, `${hash}.dat`),
    meta: path.join(hashDirectory, `${hash}.meta.json`),
  }
}

async function age(paths: string[], when: Date): Promise<void> {
  await Promise.all(paths.map((filePath) => fsp.utimes(filePath, when, when)))
}

async function index(key: string, name: string, createdAt: number): Promise<void> {
  await insertUploadFile(db, {
    storageKey: key,
    filename: `${TEST_FILE_PREFIX}${name}.txt`,
    mimeType: 'text/plain',
    size: 13,
    uploadedBy: null,
    now: createdAt,
  })
}

async function testRows() {
  let rows = await listUploadFiles(db, { limit: 1000 })
  return rows.filter((row) => row.filename.startsWith(TEST_FILE_PREFIX))
}

describe('upload_files orphan sweep', () => {
  before(async () => {
    await initializeAppDatabase()
  })

  beforeEach(async () => {
    directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'upload-files-sweep-'))
    storage = createFsFileStorage(directory)
  })

  afterEach(async () => {
    await pool.query("DELETE FROM upload_files WHERE filename LIKE 'uplsweep-%'")
    await fsp.rm(directory, { recursive: true, force: true })
  })

  it('deletes index rows whose published files are missing', async () => {
    let old = Date.now() - 2 * HOUR_MS
    let healthyKey = `uplsweep-healthy-${crypto.randomUUID()}`
    let missingKey = `uplsweep-missing-${crypto.randomUUID()}`

    await storage.set(healthyKey, testFile('healthy'))
    await storage.set(missingKey, testFile('missing'))
    await index(healthyKey, 'healthy', old)
    await index(missingKey, 'missing', old)
    let missingPaths = await pathsFor(missingKey)
    await age([missingPaths.data, missingPaths.meta], new Date(old))
    await storage.remove(missingKey)

    let result = await sweepOrphanedUploadFiles(db, directory, { graceMs: HOUR_MS })

    assert.equal(result.rows, 1, 'only the row without published files is deleted')
    assert.equal(result.files, 0, 'the sweep must not delete the healthy pair')
    assert.deepEqual(
      (await testRows()).map((row) => row.storage_key),
      [healthyKey],
      'the healthy row survives',
    )
    assert.ok(await storage.get(healthyKey), 'the healthy files remain readable')
  })

  it('leaves rows and files inside the grace period alone', async () => {
    let now = Date.now()
    let freshRowKey = `uplsweep-fresh-row-${crypto.randomUUID()}`
    let freshFileKey = `uplsweep-fresh-file-${crypto.randomUUID()}`

    // A row whose files are not visible yet (an in-flight write inserts the row
    // only after publication, but a clock/IO race must not lose data).
    await index(freshRowKey, 'fresh-row', now)
    // A file whose row has not been inserted yet (the handler publishes first).
    await storage.set(freshFileKey, testFile('fresh-file'))

    let result = await sweepOrphanedUploadFiles(db, directory, { graceMs: HOUR_MS })

    assert.equal(result.rows, 0, 'fresh rows are never candidates')
    assert.equal(result.files, 0, 'fresh published files are never candidates')
    assert.equal((await testRows()).length, 1, 'the fresh row survives')
    assert.ok(await storage.get(freshFileKey), 'the fresh file survives')
  })

  it('deletes orphan pairs and stale .upload files but keeps fresh ones', async () => {
    let old = Date.now() - 2 * HOUR_MS
    let oldDate = new Date(old)
    let orphanKey = `uplsweep-orphan-${crypto.randomUUID()}`
    let healthyKey = `uplsweep-pair-${crypto.randomUUID()}`
    let freshKey = `uplsweep-fresh-${crypto.randomUUID()}`

    await storage.set(orphanKey, testFile('orphan'))
    await storage.set(healthyKey, testFile('pair'))
    await storage.set(freshKey, testFile('fresh'))
    await index(healthyKey, 'pair', old)

    let orphanPaths = await pathsFor(orphanKey)
    let healthyPaths = await pathsFor(healthyKey)
    await age([orphanPaths.data, orphanPaths.meta], oldDate)
    await age([healthyPaths.data, healthyPaths.meta], oldDate)

    let staleTemp = path.join(
      orphanPaths.directory,
      `${orphanPaths.hash}.dat.${crypto.randomUUID()}.upload`,
    )
    let freshTemp = path.join(
      orphanPaths.directory,
      `${orphanPaths.hash}.meta.json.${crypto.randomUUID()}.upload`,
    )
    await fsp.writeFile(staleTemp, 'abandoned staging file')
    await fsp.writeFile(freshTemp, 'in-flight staging file')
    await age([staleTemp], oldDate)

    let result = await sweepOrphanedUploadFiles(db, directory, { graceMs: HOUR_MS })

    assert.equal(result.rows, 0, 'no row lost its files')
    assert.equal(result.files, 2, 'the orphan .dat/.meta.json pair is removed')
    assert.equal(result.temporaryFiles, 1, 'only the stale staging file is removed')
    assert.equal(await storage.get(orphanKey), null, 'the orphan pair is no longer readable')
    assert.ok(await storage.get(healthyKey), 'the indexed pair survives')
    assert.ok(await storage.get(freshKey), 'the fresh unindexed pair survives')
    await assert.rejects(fsp.access(staleTemp), 'the stale staging file is removed')
    await assert.doesNotReject(fsp.access(freshTemp), 'the fresh staging file is kept')
  })

  it('cleans a corrupt metadata pair and its row', async () => {
    let old = Date.now() - 2 * HOUR_MS
    let key = `uplsweep-corrupt-${crypto.randomUUID()}`

    await storage.set(key, testFile('corrupt'))
    await index(key, 'corrupt', old)
    let paths = await pathsFor(key)
    await fsp.writeFile(paths.meta, '{not valid json')
    await age([paths.data, paths.meta], new Date(old))

    let result = await sweepOrphanedUploadFiles(db, directory, { graceMs: HOUR_MS })

    assert.equal(result.files, 2, 'the unreadable .dat/.meta.json pair is removed')
    assert.equal(result.rows, 1, 'the row pointing at the removed pair is deleted')
    assert.equal((await testRows()).length, 0)
    await assert.rejects(fsp.access(paths.data))
    await assert.rejects(fsp.access(paths.meta))
  })
})
