import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { testTools } from './test-tools.ts'

describe('test-tools', () => {
  describe('list_test_files', () => {
    it('lists files in project root', async () => {
      let result = await testTools.listTestFiles.execute({ subdir: '' })
      assert.ok(Array.isArray(result.files), 'should return files array')
      assert.ok(result.files.length > 0, 'should find files')
      assert.ok(result.files.some((f: { name: string }) => f.name === 'package.json'), 'should find package.json')
    })

    it('lists files in a subdirectory', async () => {
      let result = await testTools.listTestFiles.execute({ subdir: 'app' })
      assert.ok(Array.isArray(result.files), 'should return files array')
      assert.ok(result.files.length > 0, 'should find files in app dir')
    })

    it('rejects path traversal', async () => {
      let result = await testTools.listTestFiles.execute({ subdir: '../etc' })
      assert.ok(result.error, 'should return error for path traversal')
      assert.ok(result.error.includes('Path traversal'), 'error should mention path traversal')
    })

    it('rejects absolute path', async () => {
      let result = await testTools.listTestFiles.execute({ subdir: '/etc' })
      assert.ok(result.error, 'should return error for absolute path')
    })
  })

  describe('read_test_file', () => {
    it('rejects path traversal', async () => {
      let result = await testTools.readTestFile.execute({ path: '../etc/passwd' })
      assert.ok(result.error, 'should return error')
      assert.ok(result.error.includes('Path traversal'), 'error should mention path traversal')
    })

    it('rejects absolute path', async () => {
      let result = await testTools.readTestFile.execute({ path: '/etc/passwd' })
      assert.ok(result.error, 'should return error')
    })

    it('returns error for non-existent file', async () => {
      let result = await testTools.readTestFile.execute({ path: 'does-not-exist.txt' })
      assert.ok(result.error, 'should return error for missing file')
    })
  })
})
