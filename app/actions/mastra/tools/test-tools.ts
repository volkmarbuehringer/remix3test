import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { errorEnvelope, successData } from './errors.ts'

export const PROJECT_ROOT = realpathSync(process.cwd())
const projectRoot = PROJECT_ROOT

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', 'tmp'])

const HARD_CAP = 100

type FileEntry = {
  name: string
  isDirectory: boolean
  size: number
  mtime: number
}

function resolveSafe(
  subdir: string,
): { ok: true; resolved: string } | { ok: false; error: string } {
  let resolved = path.resolve(projectRoot, subdir)
  let rel = path.relative(projectRoot, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, error: 'Path traversal detected' }
  }
  return { ok: true, resolved }
}

async function collectEntries(dir: string, recursive: boolean, ext?: string): Promise<FileEntry[]> {
  let entries = await fs.readdir(dir, { withFileTypes: true })
  let result: FileEntry[] = []

  let statsPromises = entries.map(async (e) => {
    let fullPath = path.join(dir, e.name)
    try {
      let stat = await fs.stat(fullPath)
      return { entry: e, stat, ok: true as const }
    } catch {
      return { ok: false as const }
    }
  })

  let statsResults = await Promise.all(statsPromises)

  for (let i = 0; i < entries.length; i++) {
    let e = entries[i]
    let r = statsResults[i]
    if (!r.ok) continue

    let fullPath = path.join(dir, e.name)

    if (e.isDirectory()) {
      if (recursive && !EXCLUDED_DIRS.has(e.name)) {
        let sub = await collectEntries(fullPath, recursive, ext)
        for (let entry of sub) {
          result.push(entry)
        }
      }
      if (!ext) {
        result.push({
          name: e.name + '/',
          isDirectory: true,
          size: r.stat.size,
          mtime: Math.floor(r.stat.mtimeMs),
        })
      }
    } else {
      if (ext && !e.name.endsWith(ext)) continue
      result.push({
        name: e.name,
        isDirectory: false,
        size: r.stat.size,
        mtime: Math.floor(r.stat.mtimeMs),
      })
    }
  }

  return result
}

function humanFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '\u2014'
  if (bytes < 1024) return `${bytes} B`
  let units = ['KiB', 'MiB', 'GiB', 'TiB']
  let unitIndex = -1
  let value = bytes
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(value < 10 ? 2 : 1)} ${units[unitIndex]}`
}

function sortEntries(entries: FileEntry[], sort: string, order: string): FileEntry[] {
  let sorted = [...entries]
  sorted.sort((a, b) => {
    let cmp: number
    switch (sort) {
      case 'size':
        cmp = a.size - b.size
        break
      case 'mtime':
        cmp = a.mtime - b.mtime
        break
      case 'ext': {
        let extA = a.isDirectory ? '' : a.name.includes('.') ? a.name.split('.').pop()! : ''
        let extB = b.isDirectory ? '' : b.name.includes('.') ? b.name.split('.').pop()! : ''
        cmp = extA.localeCompare(extB)
        break
      }
      default:
        cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    }
    return order === 'desc' ? -cmp : cmp
  })
  return sorted
}

const fileEntrySchema = z.object({
  name: z.string().describe('Filename with extension. Directories end with "/"'),
  isDirectory: z.boolean().describe('True for directory entries'),
  size: z.number().describe('File size in bytes — use for sorting and comparison'),
  mtime: z.number().describe('Last modification time as Unix milliseconds'),
  display: z
    .object({
      formattedSize: z
        .string()
        .describe('Human-readable file size (e.g. "1.23 KiB") — safe to show users directly'),
      type: z.enum(['file', 'directory']).describe('Entry type as readable string'),
      icon: z.string().describe('Single emoji character for visual display'),
    })
    .describe('Display hints for formatting file listings for the user'),
})

export const listTestFilesOutput = z.discriminatedUnion('success', [
  z.object({
    success: z.literal(true),
    data: z.object({
      path: z.string().describe('Directory listed, relative to project root'),
      files: z.array(fileEntrySchema),
    }),
  }),
  errorEnvelope,
])

export const listTestFiles = createTool({
  id: 'list_test_files',
  description:
    'List files and directories in the project directory. Returns names, sizes (bytes), modification times (Unix ms), and display hints (formattedSize, type, icon). Supports sorting, filtering, and recursive traversal.',
  inputSchema: z.object({
    subdir: z
      .string()
      .optional()
      .default('')
      .describe('Relative subdirectory within the project. Empty string lists the root.'),
    sort: z
      .enum(['name', 'size', 'mtime', 'ext'])
      .optional()
      .default('name')
      .describe('Sort field: name, size (bytes), mtime (modification time), ext (file extension)'),
    order: z
      .enum(['asc', 'desc'])
      .optional()
      .describe('Sort order. Default: desc for size/mtime, asc for name/ext'),
    limit: z
      .number()
      .int()
      .min(0)
      .max(100000)
      .optional()
      .default(HARD_CAP)
      .describe('Max entries to return (0 uses hard cap of 100)'),
    ext: z
      .string()
      .max(20)
      .optional()
      .describe('Filter by file extension (e.g. ".ts", ".json"). Excludes directories.'),
    recursive: z
      .boolean()
      .optional()
      .default(false)
      .describe('Traverse subdirectories recursively. Excludes .git and node_modules.'),
  }),
  outputSchema: listTestFilesOutput,
  execute: async ({ subdir, sort, order, limit, ext, recursive }) => {
    try {
      let resolved = resolveSafe(subdir)
      if (!resolved.ok) {
        return {
          success: false as const,
          error: { code: 'VALIDATION' as const, message: resolved.error },
        }
      }
      if (ext && !ext.startsWith('.')) {
        return {
          success: false as const,
          error: { code: 'VALIDATION' as const, message: 'ext must start with "." (e.g. ".ts")' },
        }
      }

      let real: string
      try {
        real = await fs.realpath(resolved.resolved)
      } catch (err) {
        let isNotFound = (err as NodeJS.ErrnoException).code === 'ENOENT'
        let code = isNotFound ? ('NOT_FOUND' as const) : ('DEPENDENCY' as const)
        return {
          success: false as const,
          error: {
            code,
            message: isNotFound
              ? `Directory not found: ${subdir}`
              : `Failed to resolve path: ${err}`,
          },
        }
      }
      let relReal = path.relative(projectRoot, real)
      if (relReal.startsWith('..') || path.isAbsolute(relReal)) {
        return {
          success: false as const,
          error: { code: 'VALIDATION' as const, message: 'Path traversal detected (symlink)' },
        }
      }

      let effectiveOrder = order ?? (sort === 'size' || sort === 'mtime' ? 'desc' : 'asc')

      let entries = await collectEntries(real, recursive, ext || undefined)
      entries = sortEntries(entries, sort, effectiveOrder)

      let effectiveLimit = Math.min(limit > 0 ? limit : HARD_CAP, HARD_CAP)
      entries = entries.slice(0, effectiveLimit)

      return successData({
        path: subdir || '/',
        files: entries.map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory,
          size: e.size,
          mtime: e.mtime,
          display: {
            formattedSize: humanFileSize(e.size),
            type: e.isDirectory ? ('directory' as const) : ('file' as const),
            icon: e.isDirectory ? ('\uD83D\uDCC1' as const) : ('\uD83D\uDCC4' as const),
          },
        })),
      })
    } catch (err) {
      return {
        success: false as const,
        error: {
          code: 'INTERNAL' as const,
          message: `Unexpected error: ${err instanceof Error ? err.message : String(err)}`,
        },
      }
    }
  },
})
