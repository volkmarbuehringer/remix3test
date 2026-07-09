import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'
import { runWithAdminId, requireAdminId } from './admin-context.ts'

describe('admin-context', () => {
  it('requireAdminId returns the ID set by runWithAdminId', () => {
    runWithAdminId(42, () => {
      assert.equal(requireAdminId(), 42)
    })
  })

  it('requireAdminId returns the correct ID for nested calls', () => {
    runWithAdminId(1, () => {
      runWithAdminId(2, () => {
        assert.equal(requireAdminId(), 2)
      })
      assert.equal(requireAdminId(), 1)
    })
  })

  it('requireAdminId throws when called outside runWithAdminId', () => {
    assert.throws(() => {
      requireAdminId()
    }, /Not authenticated as admin/)
  })

  it('runWithAdminId returns the function result', () => {
    let result = runWithAdminId(7, () => 'done')
    assert.equal(result, 'done')
  })
})
