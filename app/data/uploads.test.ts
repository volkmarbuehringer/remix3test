import { describe, it, before, afterEach } from 'remix/test'
import * as assert from 'remix/assert'
import { db, initializeAppDatabase, pool } from './setup.ts'
import { listUploads, claimUpload, getUploadDownload, insertUpload } from './uploads.ts'

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

  it('claimUpload claims an unowned upload', async () => {
    let id = await insertUpload(db, {
      filename: 'test-claim.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('c'),
      size: 1,
      now: Date.now(),
    })
    await claimUpload(db, Number(id), uploadUserId)
    let rows = await listUploads(db, uploadUserId)
    assert.ok(rows.some((r) => r.filename === 'test-claim.txt'))
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
