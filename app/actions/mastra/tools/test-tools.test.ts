import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import type { z } from 'zod/v4'

import { listTestFiles } from './test-tools.ts'
import type { listTestFilesOutput } from './test-tools.ts'

type ListTestFilesResult = z.infer<typeof listTestFilesOutput>

function call(
  fn: any,
  input: Record<string, unknown>,
): Promise<ListTestFilesResult> {
  return fn(input, {}) as Promise<ListTestFilesResult>
}

describe('test-tools', () => {
  describe('list_test_files', () => {
    it('lists files in project root', async () => {
      let result = await call(listTestFiles.execute, { subdir: '' })
      assert.ok(result.success === true)
      let files = result.data.files
      assert.ok(Array.isArray(files), 'should return files array')
      assert.ok(files.length > 0, 'should find files')
      assert.ok(files.some((f) => f.name === 'package.json'), 'should find package.json')
    })

    it('lists files in a subdirectory', async () => {
      let result = await call(listTestFiles.execute, { subdir: 'app' })
      assert.ok(result.success === true)
      let files = result.data.files
      assert.ok(Array.isArray(files), 'should return files array')
      assert.ok(files.length > 0, 'should find files in app dir')
    })

    it('rejects path traversal', async () => {
      let result = await call(listTestFiles.execute, { subdir: '../etc' })
      assert.ok(result.success === false)
      assert.equal(result.error.code, 'VALIDATION')
      assert.ok(result.error.message.includes('Path traversal'), 'error should mention path traversal')
    })

    it('rejects absolute path', async () => {
      let result = await call(listTestFiles.execute, { subdir: '/etc' })
      assert.ok(result.success === false)
      assert.equal(result.error.code, 'VALIDATION')
      assert.ok(result.error.message, 'should return error for absolute path')
    })

    it('returns size and mtime fields', async () => {
      let result = await call(listTestFiles.execute, { subdir: '' })
      assert.ok(result.success === true)
      let files = result.data.files
      assert.ok(files.length > 0, 'should find files')
      let f = files.find((f) => !f.isDirectory) ?? files[0]
      assert.equal(typeof f.size, 'number', 'size should be a number')
      assert.equal(typeof f.mtime, 'number', 'mtime should be a number')
    })

    it('sorts by name ascending by default', async () => {
      let result = await call(listTestFiles.execute, { subdir: '' })
      assert.ok(result.success === true)
      let files = result.data.files
      assert.ok(files.length >= 2, 'need at least 2 files for sort test')
      for (let i = 1; i < files.length; i++) {
        let prev = files[i - 1].name.toLowerCase()
        let curr = files[i].name.toLowerCase()
        assert.ok(prev <= curr, `should be sorted by name ascending: ${files[i - 1].name} > ${files[i].name}`)
      }
    })

    it('sorts by size descending by default', async () => {
      let result = await call(listTestFiles.execute, { subdir: '', sort: 'size' })
      assert.ok(result.success === true)
      let files = result.data.files.filter((f) => !f.name.endsWith('/'))
      assert.ok(files.length >= 2, 'need at least 2 files for sort test')
      for (let i = 1; i < files.length; i++) {
        assert.ok(files[i].size <= files[i - 1].size, 'should be sorted by size descending')
      }
    })

    it('sorts by mtime descending by default', async () => {
      let result = await call(listTestFiles.execute, { subdir: '', sort: 'mtime' })
      assert.ok(result.success === true)
      let files = result.data.files
      assert.ok(files.length >= 2, 'need at least 2 entries for sort test')
      for (let i = 1; i < files.length; i++) {
        assert.ok(files[i].mtime <= files[i - 1].mtime, 'should be sorted by mtime descending')
      }
    })

    it('sorts by ext ascending', async () => {
      let result = await call(listTestFiles.execute, {
        subdir: 'app', sort: 'ext', order: 'asc',
      })
      assert.ok(result.success === true)
      let files = result.data.files
      assert.ok(files.length >= 2, 'need at least 2 entries for ext sort test')
      let exts = files.map((f) =>
        f.isDirectory ? '' : f.name.includes('.') ? f.name.split('.').pop()! : '',
      )
      for (let i = 1; i < exts.length; i++) {
        assert.ok(exts[i - 1] <= exts[i], `ext not ascending: ${exts[i - 1]} > ${exts[i]}`)
      }
    })

    it('limits results', async () => {
      let result = await call(listTestFiles.execute, { subdir: '', limit: 3 })
      assert.ok(result.success === true)
      let files = result.data.files
      assert.equal(files.length, 3, 'should be limited to 3')
    })

    it('caps limit at 100 via recursive mode', async () => {
      let result = await call(listTestFiles.execute, {
        subdir: '', recursive: true, limit: 999,
      })
      assert.ok(result.success === true, `should not error: ${JSON.stringify(result)}`)
      let files = result.data.files
      assert.equal(files.length, 100, 'should be hard-capped at 100')
    })

    it('filters by extension', async () => {
      let result = await call(listTestFiles.execute, { subdir: '', ext: '.json' })
      assert.ok(result.success === true)
      let files = result.data.files
      assert.ok(files.length > 0, 'should find .json files')
      assert.ok(files.every((f) => f.name.endsWith('.json')), 'all files should end with .json')
    })

    it('excludes directories when ext filter is set', async () => {
      let result = await call(listTestFiles.execute, { subdir: '', ext: '.ts' })
      assert.ok(result.success === true)
      let files = result.data.files
      assert.ok(files.every((f) => !f.isDirectory), 'no directories should appear with ext filter')
    })

    it('rejects ext without leading dot', async () => {
      let result = await call(listTestFiles.execute, { subdir: '', ext: 'ts' })
      assert.ok(result.success === false)
      assert.ok(result.error.message.includes('ext must start'), `error should mention leading dot, got: ${JSON.stringify(result)}`)
    })

    it('returns display fields', async () => {
      let result = await call(listTestFiles.execute, { subdir: '' })
      assert.ok(result.success === true)
      let fileEntry = result.data.files.find((f) => !f.isDirectory && f.size > 0)
      assert.ok(fileEntry, 'should find a file entry')
      assert.ok(fileEntry!.display.formattedSize.length > 0, 'should have formattedSize')
      assert.equal(fileEntry!.display.type, 'file')
      assert.equal(typeof fileEntry!.display.icon, 'string', 'should have icon')
      let dirEntry = result.data.files.find((f) => f.isDirectory)
      if (dirEntry) {
        assert.equal(dirEntry.display.type, 'directory')
        assert.equal(dirEntry.display.icon, '\uD83D\uDCC1')
      }
    })
  })

  describe('list_test_files recursive', () => {
    it('discovers files recursively', async () => {
      let recursive = await call(listTestFiles.execute, {
        subdir: 'app', recursive: true,
      })
      assert.ok(recursive.success === true)
      let files = recursive.data.files
      let nonRecursive = await call(listTestFiles.execute, { subdir: 'app' })
      assert.ok(nonRecursive.success === true)
      let nonRecursiveFiles = nonRecursive.data.files
      assert.ok(files.length > nonRecursiveFiles.length, 'recursive should find more files')
    })

    it('excludes .git in recursive mode', async () => {
      let result = await call(listTestFiles.execute, {
        subdir: '', recursive: true,
      })
      assert.ok(result.success === true)
      let files = result.data.files
      assert.ok(!files.some((f) => f.name === 'HEAD'), 'git HEAD should be excluded')
    })

    it('excludes node_modules in recursive mode', async () => {
      let result = await call(listTestFiles.execute, {
        subdir: '', recursive: true,
      })
      assert.ok(result.success === true)
      let files = result.data.files
      assert.ok(!files.some((f) => f.name === '.modules.yaml'), 'node_modules .modules.yaml should be excluded')
    })
  })
})
