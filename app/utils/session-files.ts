import * as fsp from 'node:fs/promises'
import * as path from 'node:path'

const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * Session files untouched for this long are treated as abandoned. The cookie
 * lifetime is 30 days and every save refreshes it, so a file older than two
 * cookie lifetimes cannot belong to a live session unless the visitor read
 * pages for 60 days without a single write.
 */
export const DEFAULT_SESSION_RETENTION_MS = 60 * DAY_MS

/** A half-written `<file>.<uuid>.tmp` only survives a failed save for seconds. */
const DEFAULT_TEMP_RETENTION_MS = HOUR_MS

/** The fs store names session files by the hex digest of the session id. */
const SESSION_FILE_NAME = /^[0-9a-f]{8,}$/
const TEMP_FILE_SUFFIX = '.tmp'

export type SessionPruneResult = {
  sessions: number
  temporary: number
}

export type SessionPruneOptions = {
  now?: number
  retentionMs?: number
  tempRetentionMs?: number
}

/**
 * `SESSION_DIR` overrides the default `tmp/sessions`; a relative value is
 * resolved against the process working directory, like other path env vars.
 */
export function resolveSessionDirectory(value: string | undefined, fallback: string): string {
  let configured = value?.trim()
  return configured ? path.resolve(configured) : fallback
}

/**
 * Delete abandoned session files and crash-leftover temporary files.
 *
 * Mirrors the fs store layout (`<directory>/<2-hex-prefix>/<hash>`, plus
 * `<hash>.<uuid>.tmp` next to it) and only touches names that match it, so a
 * stray file in the directory is never removed. Missing directories and files
 * that vanish between readdir and unlink are ignored; a save running at the
 * same moment can unlink its own temporary file after we stat it.
 */
export async function pruneSessionFiles(
  directory: string,
  options: SessionPruneOptions = {},
): Promise<SessionPruneResult> {
  let now = options.now ?? Date.now()
  let retentionMs = options.retentionMs ?? DEFAULT_SESSION_RETENTION_MS
  let tempRetentionMs = options.tempRetentionMs ?? DEFAULT_TEMP_RETENTION_MS
  let sessionCutoff = now - retentionMs
  let tempCutoff = now - tempRetentionMs
  let result: SessionPruneResult = { sessions: 0, temporary: 0 }

  await pruneDirectory(directory, 1)
  return result

  // The store writes one level of subdirectories (<prefix>/<hash>); do not walk
  // deeper, so a misconfigured SESSION_DIR cannot turn the sweep into a full
  // filesystem traversal.
  async function pruneDirectory(current: string, depth: number): Promise<void> {
    let entries
    try {
      entries = await fsp.readdir(current, { withFileTypes: true })
    } catch (error) {
      if (isMissing(error)) return
      throw error
    }

    for (let entry of entries) {
      let entryPath = path.join(current, entry.name)

      if (entry.isDirectory()) {
        if (depth > 0) await pruneDirectory(entryPath, depth - 1)
        continue
      }
      if (!entry.isFile()) continue

      let temporary = entry.name.endsWith(TEMP_FILE_SUFFIX)
      if (!temporary && !SESSION_FILE_NAME.test(entry.name)) continue

      try {
        let stats = await fsp.stat(entryPath)
        if (stats.mtimeMs > (temporary ? tempCutoff : sessionCutoff)) continue

        await fsp.unlink(entryPath)
        if (temporary) result.temporary += 1
        else result.sessions += 1
      } catch (error) {
        if (!isMissing(error)) throw error
      }
    }
  }
}

function isMissing(error: unknown): boolean {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
  )
}
