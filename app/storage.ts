import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createFsFileStorage } from 'remix/file-storage/fs'

import { envString } from './config.ts'

/**
 * Directory that backs the streaming upload route (`/admin/uploadnew`).
 *
 * Resolved against the app root (not `process.cwd()`), so starting the server
 * from another working directory cannot quietly write somewhere else. The
 * directory must not live under the statically served `public/` tree: anything
 * there is served unauthenticated by `staticFiles()` and would bypass the
 * route's `requireAdmin` and attachment headers.
 *
 * The filesystem backend writes each file under a hash of its storage key plus
 * a sibling `.meta.json`, so keys have no relation to file names on disk. Point
 * `UPLOAD_FILES_DIR` at a persistent volume in production; the default lives
 * inside the container's writable `tmp/` directory (see Dockerfile) and is
 * therefore ephemeral across container replacements.
 *
 * Files from `get()` are lazy, so a download streams from disk instead of
 * loading the whole file into memory.
 */
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDirectory = path.resolve(appRoot, 'public')
const configuredDirectory = envString('UPLOAD_FILES_DIR')
const uploadFilesDirectory = path.resolve(appRoot, configuredDirectory ?? 'tmp/uploads')

if (isInside(uploadFilesDirectory, publicDirectory)) {
  throw new Error(
    `UPLOAD_FILES_DIR must not be inside the statically served public/ directory ` +
      `(resolved to ${uploadFilesDirectory}).`,
  )
}

/** Filesystem-backed store for the streaming upload route's bytes. */
export const uploadFiles = createFsFileStorage(uploadFilesDirectory)

function isInside(directory: string, parent: string): boolean {
  let relative = path.relative(parent, directory)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}
