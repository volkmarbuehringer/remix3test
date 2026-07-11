import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { listTestFiles } from './test-tools.ts'

function call(fn: any, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  return fn(input, {})
}

describe('test-tools', () => {
  describe('list_test_files', () => {
    it('lists files in project root', async () => {
      let result = await call(listTestFiles.execute, { subdir: '' })
      let files = result.files as { name: string; isDirectory: boolean; size: number; mtime: number }[]
      assert.ok(Array.isArray(files), 'should return files array')
      assert.ok(files.length > 0, 'should find files')
      assert.ok(files.some((f: { name: string }) => f.name === 'package.json'), 'should find package.json')
    })

    it('lists files in a subdirectory', async () => {
      let result = await call(listTestFiles.execute, { subdir: 'app' })
      let files = result.files as { name: string; isDirectory: boolean }[]
      assert.ok(Array.isArray(files), 'should return files array')
      assert.ok(files.length > 0, 'should find files in app dir')
    })

    it('rejects path traversal', async () => {
      let result = await call(listTestFiles.execute, { subdir: '../etc' })
      assert.ok(result.error, 'should return error for path traversal')
      assert.ok((result.error as string).includes('Path traversal'), 'error should mention path traversal')
    })

    it('rejects absolute path', async () => {
      let result = await call(listTestFiles.execute, { subdir: '/etc' })
      assert.ok(result.error, 'should return error for absolute path')
    })

    it('returns size and mtime fields', async () => {
      let result = await call(listTestFiles.execute, { subdir: '' })
      let files = result.files as { name: string; isDirectory: boolean; size: number; mtime: number }[]
      assert.ok(files.length > 0, 'should find files')
      let f = files.find((f) => !f.isDirectory) ?? files[0]
      assert.equal(typeof f.size, 'number', 'size should be a number')
      assert.equal(typeof f.mtime, 'number', 'mtime should be a number')
    })

    it('sorts by name ascending by default', async () => {
      let result = await call(listTestFiles.execute, { subdir: '' })
      let files = result.files as { name: string }[]
      assert.ok(files.length >= 2, 'need at least 2 files for sort test')
      for (let i = 1; i < files.length; i++) {
        let prev = files[i - 1].name.toLowerCase()
        let curr = files[i].name.toLowerCase()
        assert.ok(prev <= curr, `should be sorted by name ascending: ${files[i - 1].name} > ${files[i].name}`)
      }
    })

    it('sorts by size descending by default', async () => {
      let result = await call(listTestFiles.execute, { subdir: '', sort: 'size' })
      let files = (result.files as { name: string; size: number }[]).filter((f) => !f.name.endsWith('/'))
      assert.ok(files.length >= 2, 'need at least 2 files for sort test')
      for (let i = 1; i < files.length; i++) {
        assert.ok(files[i].size <= files[i - 1].size, 'should be sorted by size descending')
      }
    })

    it('sorts by mtime descending by default', async () => {
      let result = await call(listTestFiles.execute, { subdir: '', sort: 'mtime' })
      let files = result.files as { mtime: number }[]
      assert.ok(files.length >= 2, 'need at least 2 entries for sort test')
      for (let i = 1; i < files.length; i++) {
        assert.ok(files[i].mtime <= files[i - 1].mtime, 'should be sorted by mtime descending')
      }
    })

    it('sorts by ext ascending', async () => {
      let result = await call(listTestFiles.execute, {
        subdir: 'app', sort: 'ext', order: 'asc',
      })
      let files = result.files as { name: string; isDirectory: boolean }[]
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
      let files = result.files as any[]
      assert.equal(files.length, 3, 'should be limited to 3')
    })

    it('caps limit at 100 via recursive mode', async () => {
      let result = await call(listTestFiles.execute, {
        subdir: '', recursive: true, limit: 999,
      })
      assert.ok(!result.error, `should not error: ${JSON.stringify(result.error)}`)
      let files = result.files as any[]
      assert.equal(files.length, 100, 'should be hard-capped at 100')
    })

    it('filters by extension', async () => {
      let result = await call(listTestFiles.execute, { subdir: '', ext: '.json' })
      let files = result.files as { name: string }[]
      assert.ok(files.length > 0, 'should find .json files')
      assert.ok(files.every((f) => f.name.endsWith('.json')), 'all files should end with .json')
    })

    it('excludes directories when ext filter is set', async () => {
      let result = await call(listTestFiles.execute, { subdir: '', ext: '.ts' })
      let files = result.files as { isDirectory: boolean }[]
      assert.ok(files.every((f) => !f.isDirectory), 'no directories should appear with ext filter')
    })

    it('rejects ext without leading dot', async () => {
      let result = await call(listTestFiles.execute, { subdir: '', ext: 'ts' })
      let errMsg = (result.message as string) || JSON.stringify(result)
      assert.ok(errMsg.includes('ext must start'), `error should mention leading dot, got: ${errMsg}`)
    })
  })

  describe('list_test_files recursive', () => {
    it('discovers files recursively', async () => {
      let result = await call(listTestFiles.execute, {
        subdir: 'app', recursive: true,
      })
      let files = result.files as { name: string }[]
      let nonRecursive = await call(listTestFiles.execute, { subdir: 'app' })
      let nonRecursiveFiles = nonRecursive.files as { name: string }[]
      assert.ok(files.length > nonRecursiveFiles.length, 'recursive should find more files')
    })

    it('excludes .git in recursive mode', async () => {
      let result = await call(listTestFiles.execute, {
        subdir: '', recursive: true,
      })
      let files = result.files as any[]
      assert.ok(!files.some((f: any) => f.name === 'HEAD'), 'git HEAD should be excluded')
    })

    it('excludes node_modules in recursive mode', async () => {
      let result = await call(listTestFiles.execute, {
        subdir: '', recursive: true,
      })
      let files = result.files as any[]
      // .modules.yaml only exists in node_modules/.pnpm/.modules.yaml.
      // If node_modules exclusion is broken, this file would appear.
      assert.ok(!files.some((f: any) => f.name === '.modules.yaml'), 'node_modules .modules.yaml should be excluded')
    })
  })
})
