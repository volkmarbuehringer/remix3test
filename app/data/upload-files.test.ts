import { afterEach, before, describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { db, initializeAppDatabase } from '../db.ts'
import { pool } from '../../test/pool.ts'
import {
  insertUploadFile,
  insertUploadFileWithinUserQuota,
  listUploadFiles,
  sumUploadFileBytesForUser,
  uploadFilesPerUserQuotaBytes,
} from './upload-files.ts'

const TEST_FILE_PREFIX = 'uplfiles-'
const DEFAULT_PER_USER_QUOTA = 100 * 1024 * 1024

/** Dedicated users so the per-user SUM never includes another suite's rows. */
async function ensureTestUser(email: string): Promise<number> {
  let result = await pool.query(
    `INSERT INTO users (email, password_hash, name, role, email_verified, token_version, created_at, updated_at)
     VALUES ($1, 'x', 'Upload quota test', 'customer', 1, 1, $2, $2)
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [email, Date.now()],
  )
  return Number(result.rows[0].id)
}

/** Index a row directly (no filesystem object: these tests only exercise SQL). */
async function insertRow(name: string, size: number, uploadedBy: number | null): Promise<string> {
  return await insertUploadFile(db, {
    storageKey: `uplfiles-key-${crypto.randomUUID()}`,
    filename: name,
    mimeType: 'image/png',
    size,
    uploadedBy,
    now: Date.now(),
  })
}

async function testRows(): Promise<number> {
  return (await listUploadFiles(db, { limit: 1000 })).filter((row) =>
    row.filename.startsWith(TEST_FILE_PREFIX),
  ).length
}

function withQuotaEnv<T>(value: string | undefined, run: () => T): T {
  let previous = process.env.UPLOAD_FILES_PER_USER_QUOTA_BYTES
  if (value === undefined) delete process.env.UPLOAD_FILES_PER_USER_QUOTA_BYTES
  else process.env.UPLOAD_FILES_PER_USER_QUOTA_BYTES = value
  try {
    return run()
  } finally {
    if (previous === undefined) delete process.env.UPLOAD_FILES_PER_USER_QUOTA_BYTES
    else process.env.UPLOAD_FILES_PER_USER_QUOTA_BYTES = previous
  }
}

describe('upload-files quota helpers', () => {
  let ownerId: number
  let otherId: number

  before(async () => {
    await initializeAppDatabase()
    ownerId = await ensureTestUser('uplfiles-owner@newapp.com')
    otherId = await ensureTestUser('uplfiles-other@newapp.com')
  })

  afterEach(async () => {
    await pool.query("DELETE FROM upload_files WHERE filename LIKE 'uplfiles-%'")
  })

  it("sumUploadFileBytesForUser counts only the given user's rows", async () => {
    await insertRow(`${TEST_FILE_PREFIX}owner-a.png`, 5, ownerId)
    await insertRow(`${TEST_FILE_PREFIX}owner-b.png`, 7, ownerId)
    await insertRow(`${TEST_FILE_PREFIX}other.png`, 11, otherId)
    await insertRow(`${TEST_FILE_PREFIX}unowned.png`, 13, null)

    assert.equal(await sumUploadFileBytesForUser(db, ownerId), 12)
    assert.equal(await sumUploadFileBytesForUser(db, otherId), 11)
  })

  it('insertUploadFileWithinUserQuota admits files that still fit', async () => {
    let first = await insertUploadFileWithinUserQuota(
      db,
      {
        storageKey: `uplfiles-key-${crypto.randomUUID()}`,
        filename: `${TEST_FILE_PREFIX}fit-a.png`,
        mimeType: 'image/png',
        size: 4,
        uploadedBy: ownerId,
        now: Date.now(),
      },
      10,
    )
    assert.equal(first.ok, true)

    // Exactly at the cap is allowed; only crossing it is rejected.
    let second = await insertUploadFileWithinUserQuota(
      db,
      {
        storageKey: `uplfiles-key-${crypto.randomUUID()}`,
        filename: `${TEST_FILE_PREFIX}fit-b.png`,
        mimeType: 'image/png',
        size: 6,
        uploadedBy: ownerId,
        now: Date.now(),
      },
      10,
    )
    assert.equal(second.ok, true)
    assert.equal(await sumUploadFileBytesForUser(db, ownerId), 10)
  })

  it('insertUploadFileWithinUserQuota rejects a file that would cross the cap', async () => {
    let first = await insertUploadFileWithinUserQuota(
      db,
      {
        storageKey: `uplfiles-key-${crypto.randomUUID()}`,
        filename: `${TEST_FILE_PREFIX}cross-a.png`,
        mimeType: 'image/png',
        size: 6,
        uploadedBy: ownerId,
        now: Date.now(),
      },
      10,
    )
    assert.equal(first.ok, true)

    // The row must not exist: the caller removes the bytes, the data layer
    // must not have recorded the rejected upload.
    let second = await insertUploadFileWithinUserQuota(
      db,
      {
        storageKey: `uplfiles-key-${crypto.randomUUID()}`,
        filename: `${TEST_FILE_PREFIX}cross-b.png`,
        mimeType: 'image/png',
        size: 5,
        uploadedBy: ownerId,
        now: Date.now(),
      },
      10,
    )
    if (second.ok) throw new Error('expected the over-quota insert to be rejected')
    assert.equal(second.reason, 'per_user_quota')
    assert.equal(await sumUploadFileBytesForUser(db, ownerId), 6)
    assert.equal(await testRows(), 1)
  })

  it('insertUploadFileWithinUserQuota serializes concurrent admissions', async () => {
    let data = (name: string) => ({
      storageKey: `uplfiles-key-${crypto.randomUUID()}`,
      filename: `${TEST_FILE_PREFIX}${name}.png`,
      mimeType: 'image/png',
      size: 6,
      uploadedBy: ownerId,
      now: Date.now(),
    })

    // Both files individually fit, but only one may be admitted: without the
    // per-user advisory lock both transactions would read 0 bytes used first.
    let results = await Promise.all([
      insertUploadFileWithinUserQuota(db, data('race-a'), 10),
      insertUploadFileWithinUserQuota(db, data('race-b'), 10),
    ])

    assert.equal(results.filter((result) => result.ok).length, 1)
    assert.equal(await testRows(), 1)
    assert.equal(await sumUploadFileBytesForUser(db, ownerId), 6)
  })

  it('insertUploadFileWithinUserQuota inserts ownerless rows against the global quota only', async () => {
    let result = await insertUploadFileWithinUserQuota(
      db,
      {
        storageKey: `uplfiles-key-${crypto.randomUUID()}`,
        filename: `${TEST_FILE_PREFIX}ownerless.png`,
        mimeType: 'image/png',
        size: 6,
        uploadedBy: null,
        now: Date.now(),
      },
      1,
    )
    assert.equal(result.ok, true)
  })

  it('uploadFilesPerUserQuotaBytes reads the env var at call time', () => {
    withQuotaEnv(undefined, () => {
      assert.equal(uploadFilesPerUserQuotaBytes(), DEFAULT_PER_USER_QUOTA)
    })
    withQuotaEnv('12345', () => {
      assert.equal(uploadFilesPerUserQuotaBytes(), 12345)
    })
    // Non-positive and non-numeric values fall back instead of disabling uploads.
    withQuotaEnv('0', () => {
      assert.equal(uploadFilesPerUserQuotaBytes(), DEFAULT_PER_USER_QUOTA)
    })
    withQuotaEnv('not-a-number', () => {
      assert.equal(uploadFilesPerUserQuotaBytes(), DEFAULT_PER_USER_QUOTA)
    })
  })
})
