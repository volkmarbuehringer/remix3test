import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { realpathSync } from 'node:fs'

const projectRoot = realpathSync(process.cwd())

const EXCLUDED_DIRS = new Set(['.git', 'node_modules'])

const HARD_CAP = 100

type FileEntry = {
  name: string
  isDirectory: boolean
  size: number
  mtime: number
}

function resolveSafe(subdir: string): { ok: true; resolved: string } | { ok: false; error: string } {
  let resolved = path.resolve(projectRoot, subdir)
  let rel = path.relative(projectRoot, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, error: 'Path traversal detected' }
  }
  return { ok: true, resolved }
}

async function collectEntries(
  dir: string,
  recursive: boolean,
  ext?: string,
): Promise<FileEntry[]> {
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
        result.push(...sub)
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

export const testTools = {
  listTestFiles: createTool({
    id: 'list_test_files',
    description:
      'List files and directories in the project directory. Returns names, sizes (bytes), and modification times (Unix ms). Supports sorting, filtering, and recursive traversal.',
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
        .refine((s) => !s || s.startsWith('.'), 'ext must start with "." (e.g. ".ts")')
        .describe('Filter by file extension (e.g. ".ts", ".json"). Excludes directories.'),
      recursive: z
        .boolean()
        .optional()
        .default(false)
        .describe('Traverse subdirectories recursively. Excludes .git and node_modules.'),
    }),
    execute: async ({ subdir, sort, order, limit, ext, recursive }) => {
      let resolved = resolveSafe(subdir)
      if (!resolved.ok) return { error: resolved.error }
      if (ext && !ext.startsWith('.')) return { error: 'ext must start with "." (e.g. ".ts")' }

      let real: string
      try {
        real = await fs.realpath(resolved.resolved)
      } catch (err) {
        return { error: `Failed to resolve path: ${err}` }
      }
      let relReal = path.relative(projectRoot, real)
      if (relReal.startsWith('..') || path.isAbsolute(relReal)) {
        return { error: 'Path traversal detected (symlink)' }
      }

      let effectiveOrder =
        order ?? (sort === 'size' || sort === 'mtime' ? 'desc' : 'asc')

      let entries = await collectEntries(real, recursive, ext || undefined)
      entries = sortEntries(entries, sort, effectiveOrder)

      let effectiveLimit = Math.min(limit > 0 ? limit : HARD_CAP, HARD_CAP)
      entries = entries.slice(0, effectiveLimit)

      return {
        path: subdir || '/',
        files: entries.map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory,
          size: e.size,
          mtime: e.mtime,
        })),
      }
    },
  }),

  readTestFile: createTool({
    id: 'read_test_file',
    description:
      'Read the content of a file in the project directory. This tool requires approval before execution.',
    inputSchema: z.object({
      path: z.string().min(1).max(500).describe('Relative path to the file within the project'),
      purpose: z
        .string()
        .optional()
        .default('')
        .describe('Brief explanation of why this file needs to be read'),
    }),
    execute: async ({ path: filePath, purpose }) => {
      let resolved = resolveSafe(filePath)
      if (!resolved.ok) return { error: resolved.error }
      try {
        let real = await fs.realpath(resolved.resolved)
        let relReal = path.relative(projectRoot, real)
        if (relReal.startsWith('..') || path.isAbsolute(relReal)) {
          return { error: 'Path traversal detected (symlink)', path: filePath }
        }
        let content = await fs.readFile(real, 'utf-8')
        return { path: filePath, content, length: content.length, purpose: purpose || undefined }
      } catch (err) {
        return { error: String(err), path: filePath }
      }
    },
  }),
}
