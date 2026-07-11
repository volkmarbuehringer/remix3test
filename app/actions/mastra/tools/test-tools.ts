import { createTool } from '@mastra/core/tools'
import { z } from 'zod/v4'
import * as path from 'node:path'
import * as fs from 'node:fs/promises'
import { realpathSync } from 'node:fs'

let projectRoot = realpathSync(process.cwd())

function resolveSafe(subdir: string): { ok: true; resolved: string } | { ok: false; error: string } {
  let resolved = path.resolve(projectRoot, subdir)
  let rel = path.relative(projectRoot, resolved)
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    return { ok: false, error: 'Path traversal detected' }
  }
  return { ok: true, resolved }
}

export const testTools = {
  listTestFiles: createTool({
    id: 'list_test_files',
    description:
      'List files and directories in the project directory. Returns names and types only, no file contents.',
    inputSchema: z.object({
      subdir: z
        .string()
        .optional()
        .default('')
        .describe('Relative subdirectory within the project. Empty string lists the root.'),
    }),
    execute: async ({ subdir }) => {
      let resolved = resolveSafe(subdir)
      if (!resolved.ok) return { error: resolved.error }
      let entries = await fs.readdir(resolved.resolved, { withFileTypes: true })
      return {
        path: subdir || '/',
        files: entries.map((e) => ({
          name: e.isDirectory() ? e.name + '/' : e.name,
          isDirectory: e.isDirectory(),
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
