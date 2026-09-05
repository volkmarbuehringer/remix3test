import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase } from '../db.ts'
import { pool } from './test-pool.ts'
import {
  listUploads,
  countUploads,
  getUploadsPage,
  claimUpload,
  claimUploads,
  getUploadDownload,
  insertUpload,
} from './uploads.ts'

describe('uploads', () => {
  let uploadUserId: number

  before(async () => {
    await initializeAppDatabase()
    let result = await pool.query("SELECT id FROM users WHERE email = 'admin@newapp.com'")
    uploadUserId = result.rows[0].id
  })

  afterEach(async () => {
    await pool.query("DELETE FROM uploads WHERE filename LIKE 'test-%'")
  })

  it('insertUpload inserts a row and returns its id as string', async () => {
    let id = await insertUpload(db, {
      filename: 'test-hello.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
      size: 5,
      now: Date.now(),
    })
    assert.ok(typeof id === 'string')
    assert.ok(Number(id) > 0)
  })

  it('listUploads returns rows', async () => {
    await insertUpload(db, {
      filename: 'test-list-a.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('a'),
      size: 1,
      now: Date.now(),
    })
    let rows = await listUploads(db)
    assert.ok(rows.length >= 1)
  })

  it('listUploads filters by userId when provided', async () => {
    let id = await insertUpload(db, {
      filename: 'test-filter.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('f'),
      size: 1,
      now: Date.now(),
    })
    await claimUpload(db, Number(id), uploadUserId)
    let rows = await listUploads(db, uploadUserId)
    assert.ok(rows.some((r) => r.filename === 'test-filter.txt'))
  })

  it('listUploads returns empty array for non-existent user', async () => {
    let rows = await listUploads(db, 999999)
    assert.ok(Array.isArray(rows))
    assert.equal(rows.length, 0)
  })

  it('countUploads returns the number of uploads', async () => {
    await insertUpload(db, {
      filename: 'test-count.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('a'),
      size: 1,
      now: Date.now(),
    })
    let total = await countUploads(db)
    assert.ok(total >= 1)
    assert.ok((await countUploads(db, uploadUserId)) >= 0)
  })

  it('listUploads applies limit and offset in newest-first order', async () => {
    for (let i = 1; i <= 3; i++) {
      await insertUpload(db, {
        filename: `test-pg-${i}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from(String(i)),
        size: 1,
        now: Date.now(),
      })
    }
    // Skip the two newest (test-pg-3, test-pg-2), keep one row (test-pg-1).
    let page = await listUploads(db, undefined, { limit: 2, offset: 2 })
    assert.equal(page.length, 1)
    assert.equal(page[0]!.filename, 'test-pg-1.txt')
  })

  it('getUploadsPage paginates and clamps out-of-range pages', async () => {
    for (let i = 1; i <= 25; i++) {
      await insertUpload(db, {
        filename: `test-page-${i}.txt`,
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
        size: 1,
        now: Date.now(),
      })
    }
    let page1 = await getUploadsPage(db, undefined, 1, 20)
    assert.equal(page1.total, 25)
    assert.equal(page1.totalPages, 2)
    assert.equal(page1.rows.length, 20)

    let page2 = await getUploadsPage(db, undefined, 2, 20)
    assert.equal(page2.page, 2)
    assert.equal(page2.rows.length, 5)

    let clamped = await getUploadsPage(db, undefined, 99, 20)
    assert.equal(clamped.page, 2)
    assert.equal(clamped.rows.length, 5)
  })

  it('claimUpload claims an unowned upload', async () => {
    let id = await insertUpload(db, {
      filename: 'test-claim.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('c'),
      size: 1,
      now: Date.now(),
    })
    let claimed = await claimUpload(db, Number(id), uploadUserId)
    assert.ok(claimed)
    let rows = await listUploads(db, uploadUserId)
    assert.ok(rows.some((r) => r.filename === 'test-claim.txt'))
  })

  it('claimUpload returns false for a non-existent upload', async () => {
    let claimed = await claimUpload(db, 999999999, uploadUserId)
    assert.equal(claimed, false)
  })

  it('claimUploads claims a batch of uploads in one quota check', async () => {
    let idA = await insertUpload(db, {
      filename: 'test-batch-a.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('aaa'),
      size: 3,
      now: Date.now(),
    })
    let idB = await insertUpload(db, {
      filename: 'test-batch-b.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('bbbb'),
      size: 4,
      now: Date.now(),
    })
    let claimed = await claimUploads(
      db,
      [Number(idA), Number(idB)],
      uploadUserId,
      Number.MAX_SAFE_INTEGER,
    )
    assert.equal(claimed, true)
    let rows = await listUploads(db, uploadUserId)
    assert.ok(rows.some((r) => r.filename === 'test-batch-a.txt'))
    assert.ok(rows.some((r) => r.filename === 'test-batch-b.txt'))
  })

  it('claimUploads rejects and deletes the whole batch when quota is exceeded', async () => {
    let idA = await insertUpload(db, {
      filename: 'test-batch-q-a.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('aaaa'),
      size: 4,
      now: Date.now(),
    })
    let idB = await insertUpload(db, {
      filename: 'test-batch-q-b.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('bbbbbbb'),
      size: 7,
      now: Date.now(),
    })
    // Each file alone fits within the 10-byte quota, but the batch (11 bytes on
    // top of nothing) does not — no file may slip through by being claimed last.
    let claimed = await claimUploads(db, [Number(idA), Number(idB)], uploadUserId, 10)
    assert.equal(claimed, false)
    let result = await pool.query(
      'SELECT id FROM uploads WHERE id = ANY($1) AND uploaded_by IS NULL',
      [[Number(idA), Number(idB)]],
    )
    assert.equal(result.rows.length, 0)
  })

  it('claimUploads returns false for an empty batch', async () => {
    let claimed = await claimUploads(db, [], uploadUserId)
    assert.equal(claimed, false)
  })

  it('claimUploads returns false when no batch row is claimable', async () => {
    let claimed = await claimUploads(db, [999999999], uploadUserId)
    assert.equal(claimed, false)
  })

  it('claimUpload rejects and deletes the upload when the per-user quota is exceeded', async () => {
    let id = await insertUpload(db, {
      filename: 'test-quota.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('too big for the quota'),
      size: 22,
      now: Date.now(),
    })
    let claimed = await claimUpload(db, Number(id), uploadUserId, 10)
    assert.equal(claimed, false)
    let result = await pool.query('SELECT * FROM uploads WHERE id = $1', [Number(id)])
    assert.equal(result.rows.length, 0)
  })

  it('getUploadDownload returns undefined for non-existent id', async () => {
    let result = await getUploadDownload(db, 999999999)
    assert.equal(result, undefined)
  })

  it('getUploadDownload returns file for owned upload', async () => {
    let id = await insertUpload(db, {
      filename: 'test-dl.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('content'),
      size: 7,
      now: Date.now(),
    })
    await claimUpload(db, Number(id), uploadUserId)
    let file = await getUploadDownload(db, Number(id), uploadUserId)
    assert.ok(file !== undefined)
    assert.equal(file!.filename, 'test-dl.txt')
    assert.equal(file!.mime_type, 'text/plain')
  })

  it('getUploadDownload returns undefined when userId does not match', async () => {
    let id = await insertUpload(db, {
      filename: 'test-dl-no-access.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('private'),
      size: 7,
      now: Date.now(),
    })
    await claimUpload(db, Number(id), uploadUserId)
    let file = await getUploadDownload(db, Number(id), -1)
    assert.equal(file, undefined)
  })
})
