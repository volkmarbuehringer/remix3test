import type { Dirent, Stats } from 'node:fs'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

import { sql, type Database } from 'remix/data-table'
import { z } from 'zod/v4'

import { envPositiveNumber } from '../config.ts'
import { queryRows } from './rows.ts'

const HOUR_MS = 60 * 60 * 1000
const DEFAULT_GRACE_MS = HOUR_MS
const DEFAULT_BATCH_SIZE = 1000
const DATA_SUFFIX = '.dat'
const META_SUFFIX = '.meta.json'
const TEMP_SUFFIX = '.upload'

/**
 * Counts from one orphan sweep. `files` counts published `.dat`/`.meta.json`
 * paths, `temporaryFiles` counts abandoned `.upload` staging files, and `rows`
 * counts `upload_files` rows whose published files were missing.
 */
export type UploadFileSweepResult = {
  rows: number
  files: number
  temporaryFiles: number
}

export type UploadFileSweepOptions = {
  /** Clock override for tests; defaults to `Date.now()`. */
  now?: number
  /** Age below which rows/files are left alone; defaults to one hour. */
  graceMs?: number
  /** Maximum rows checked (and ids deleted) per statement. */
  batchSize?: number
}

/**
 * Remove filesystem uploads that no longer have a matching pair of index row
 * and published files.
 *
 * The streaming upload handler writes the `.dat`/`.meta.json` pair first and
 * inserts the `upload_files` row afterwards; deletion removes the row first and
 * then the files. Both orders can be interrupted, and #11909's staged writes can
 * leave an abandoned `.upload` file when the process dies mid-write. This sweep
 * reconciles both directions:
 *
 * - a row older than the grace period whose `.dat` or `.meta.json` is missing
 *   is deleted (the filesystem is the authority for the bytes);
 * - a published pair older than the grace period whose key has no row, whose
 *   metadata is unreadable, or whose `.dat` or `.meta.json` is missing is
 *   deleted;
 * - an abandoned `.upload` staging file older than the grace period is deleted.
 *
 * The grace period protects in-flight uploads: files written seconds ago are
 * never candidates, even when their row has not been inserted yet.
 */
export async function sweepOrphanedUploadFiles(
  db: Database,
  directory: string,
  options: UploadFileSweepOptions = {},
): Promise<UploadFileSweepResult> {
  let root = path.resolve(directory)
  let now = options.now ?? Date.now()
  let graceMs = Math.max(
    0,
    options.graceMs ?? envPositiveNumber('UPLOAD_FILES_ORPHAN_GRACE_MS', DEFAULT_GRACE_MS),
  )
  let cutoff = now - graceMs
  let batchSize = Math.max(1, Math.floor(options.batchSize ?? DEFAULT_BATCH_SIZE))

  let storage = await sweepStorageFiles(db, root, cutoff, batchSize)
  let rows = await deleteRowsMissingFiles(db, root, cutoff, batchSize)
  return { rows, files: storage.files, temporaryFiles: storage.temporaryFiles }
}

type HashGroup = {
  data?: string
  meta?: string
}

type StorageSweepResult = Pick<UploadFileSweepResult, 'files' | 'temporaryFiles'>

async function sweepStorageFiles(
  db: Database,
  root: string,
  cutoff: number,
  batchSize: number,
): Promise<StorageSweepResult> {
  let result: StorageSweepResult = { files: 0, temporaryFiles: 0 }
  let subdirectories = await readDirectory(root)
  if (subdirectories == null) return result

  for (let subdirectory of subdirectories) {
    if (!subdirectory.isDirectory()) continue
    let directory = path.join(root, subdirectory.name)
    let entries = await readDirectory(directory)
    if (entries == null) continue

    let groups = new Map<string, HashGroup>()
    for (let entry of entries) {
      if (!entry.isFile()) continue
      let fullPath = path.join(directory, entry.name)

      if (entry.name.endsWith(TEMP_SUFFIX)) {
        if (await isOlderThan(fullPath, cutoff)) {
          await fs.rm(fullPath, { force: true })
          result.temporaryFiles++
        }
        continue
      }

      if (entry.name.endsWith(META_SUFFIX)) {
        let hash = entry.name.slice(0, -META_SUFFIX.length)
        let group = groups.get(hash) ?? {}
        group.meta = fullPath
        groups.set(hash, group)
        continue
      }

      if (entry.name.endsWith(DATA_SUFFIX)) {
        let hash = entry.name.slice(0, -DATA_SUFFIX.length)
        let group = groups.get(hash) ?? {}
        group.data = fullPath
        groups.set(hash, group)
      }
    }

    let orphanPaths: string[] = []
    let candidates: Array<{ key: string; data: string; meta: string }> = []

    for (let group of groups.values()) {
      let dataStat = group.data == null ? null : await statOrNull(group.data)
      let metaStat = group.meta == null ? null : await statOrNull(group.meta)
      if (dataStat == null && metaStat == null) continue

      // A file written inside the grace window may belong to an in-flight
      // upload whose row has not been inserted yet. Leave the whole pair alone.
      if ((dataStat?.mtimeMs ?? 0) >= cutoff || (metaStat?.mtimeMs ?? 0) >= cutoff) continue

      // One half of the pair is gone (interrupted publication or manual
      // removal). The remaining file is not downloadable; remove it.
      if (dataStat == null || metaStat == null) {
        if (group.data != null) orphanPaths.push(group.data)
        if (group.meta != null) orphanPaths.push(group.meta)
        continue
      }

      let key = await readMetadataKey(group.meta!)
      if (key == null) {
        orphanPaths.push(group.data!, group.meta!)
        continue
      }
      candidates.push({ key, data: group.data!, meta: group.meta! })
    }

    let referenced = await referencedStorageKeys(db, candidates, batchSize)
    for (let candidate of candidates) {
      if (!referenced.has(candidate.key)) orphanPaths.push(candidate.data, candidate.meta)
    }

    for (let orphanPath of orphanPaths) {
      await fs.rm(orphanPath, { force: true })
      result.files++
    }
    if (orphanPaths.length > 0) {
      // Best effort: only removes the hash directory when nothing fresh remains.
      await fs.rmdir(directory).catch(() => {})
    }
  }

  return result
}

async function referencedStorageKeys(
  db: Database,
  candidates: Array<{ key: string }>,
  batchSize: number,
): Promise<Set<string>> {
  let referenced = new Set<string>()
  for (let offset = 0; offset < candidates.length; offset += batchSize) {
    let chunk = candidates.slice(offset, offset + batchSize)
    let rows = await queryRows(
      db,
      sql`SELECT storage_key FROM upload_files
         WHERE storage_key = ANY(${chunk.map((candidate) => candidate.key)}::text[])`,
      z.object({ storage_key: z.string() }),
    )
    for (let row of rows) referenced.add(row.storage_key)
  }
  return referenced
}

async function deleteRowsMissingFiles(
  db: Database,
  root: string,
  cutoff: number,
  batchSize: number,
): Promise<number> {
  let deleted = 0
  let cursor = 0

  for (;;) {
    let rows = await queryRows(
      db,
      sql`SELECT id, storage_key FROM upload_files
         WHERE created_at < ${cutoff} AND id > ${cursor}
         ORDER BY id
         LIMIT ${batchSize}`,
      z.object({ id: z.number(), storage_key: z.string() }),
    )
    if (rows.length === 0) break

    let missing: number[] = []
    for (let row of rows) {
      cursor = row.id
      let hash = await sha256Hex(row.storage_key)
      let directory = path.join(root, hash.slice(0, 2))
      let dataPath = path.join(directory, `${hash}${DATA_SUFFIX}`)
      let metaPath = path.join(directory, `${hash}${META_SUFFIX}`)
      let [data, meta] = await Promise.all([statOrNull(dataPath), statOrNull(metaPath)])
      if (data == null || meta == null) missing.push(row.id)
    }

    for (let offset = 0; offset < missing.length; offset += batchSize) {
      let chunk = missing.slice(offset, offset + batchSize)
      let result = await db.exec('DELETE FROM upload_files WHERE id = ANY($1::int[])', [chunk])
      deleted += result.affectedRows ?? 0
    }

    if (rows.length < batchSize) break
  }

  return deleted
}

async function readDirectory(directory: string): Promise<Dirent[] | null> {
  try {
    return await fs.readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

async function statOrNull(filePath: string): Promise<Stats | null> {
  try {
    return await fs.stat(filePath)
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

async function isOlderThan(filePath: string, cutoff: number): Promise<boolean> {
  let stats = await statOrNull(filePath)
  return stats != null && stats.mtimeMs < cutoff
}

async function readMetadataKey(metaPath: string): Promise<string | null> {
  let text: string
  try {
    text = await fs.readFile(metaPath, 'utf8')
  } catch (error) {
    // The file disappeared between readdir and read: the remaining half is an
    // orphan and is still removed by the caller. Other IO errors abort the
    // sweep instead of deleting bytes that a transient failure hid from us.
    if (isNotFound(error)) return null
    throw error
  }

  try {
    let metadata = JSON.parse(text) as { key?: unknown }
    return typeof metadata.key === 'string' && metadata.key.length > 0 ? metadata.key : null
  } catch {
    return null
  }
}

async function sha256Hex(value: string): Promise<string> {
  let digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Buffer.from(digest).toString('hex')
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ENOENT'
  )
}
