import { describe, it } from 'remix/test'
import * as assert from 'remix/assert'

import { hashPassword, verifyPassword } from './password-hash.ts'

// ---------------------------------------------------------------------------
// Password hashing pure function tests
// ---------------------------------------------------------------------------

describe('hashPassword / verifyPassword', () => {
  // -----------------------------------------------------------------------
  // Round-trip: happy path
  // -----------------------------------------------------------------------

  it('round-trip: hashPassword then verifyPassword returns true for same password', async () => {
    // Arrange
    let password = 'test123'

    // Act
    let hash = await hashPassword(password)
    let result = await verifyPassword(password, hash)

    // Assert
    assert.ok(result, 'should verify the correct password')
  })

  it('verifyPassword returns false for a different password', async () => {
    // Arrange
    let hash = await hashPassword('real-password')

    // Act
    let result = await verifyPassword('wrong-password', hash)

    // Assert
    assert.ok(!result, 'should reject the wrong password')
  })

  // -----------------------------------------------------------------------
  // Format / prefix validation
  // -----------------------------------------------------------------------

  it('verifyPassword returns false for a badly-formatted hash', async () => {
    // Arrange
    let badHash = 'bad$format'

    // Act
    let result = await verifyPassword('test', badHash)

    // Assert
    assert.ok(!result, 'should reject a hash with wrong prefix')
  })

  it('verifyPassword returns false for a hash with unknown prefix', async () => {
    // Arrange
    let badHash = 'unknown_prefix$10000$salt$hash'

    // Act
    let result = await verifyPassword('test', badHash)

    // Assert
    assert.ok(!result, 'should reject a hash with unknown prefix')
  })

  // -----------------------------------------------------------------------
  // Edge cases — empty / falsy inputs
  // -----------------------------------------------------------------------

  it('verifyPassword returns false for empty password against a valid hash', async () => {
    // Arrange
    let hash = await hashPassword('some-password')

    // Act
    let result = await verifyPassword('', hash)

    // Assert
    assert.ok(!result, 'should reject empty password')
  })

  it('hashPassword and verifyPassword work with empty password', async () => {
    // Arrange / Act
    let hash = await hashPassword('')
    let result = await verifyPassword('', hash)

    // Assert
    assert.ok(result, 'empty password round-trip should succeed')
  })

  // -----------------------------------------------------------------------
  // Unicode support
  // -----------------------------------------------------------------------

  it('round-trip works with unicode characters', async () => {
    // Arrange
    let password = 'héllo🚀世界'

    // Act
    let hash = await hashPassword(password)
    let result = await verifyPassword(password, hash)

    // Assert
    assert.ok(result, 'should verify unicode password')
  })

  it('verifyPassword returns false for unicode wrong password', async () => {
    // Arrange
    let hash = await hashPassword('héllo🚀世界')

    // Act
    let wrongResult = await verifyPassword('héllo🚀world', hash)

    // Assert
    assert.ok(!wrongResult, 'should reject wrong unicode password')
  })

  // -----------------------------------------------------------------------
  // Malformed hash strings — verifyPassword should return false, not throw
  // -----------------------------------------------------------------------

  it('verifyPassword returns false for a hash with missing parts (fewer than 4 segments)', async () => {
    // Act
    let result = await verifyPassword('test', 'pbkdf2_sha256$100000')

    // Assert
    assert.ok(!result, 'should handle hash with missing segments')
  })

  it('verifyPassword returns false for a hash with invalid iterations (non-integer)', async () => {
    // Act
    let result = await verifyPassword('test', 'pbkdf2_sha256$abc$salt$hash')

    // Assert
    assert.ok(!result, 'should handle non-integer iterations')
  })

  it('verifyPassword returns false for a hash with zero iterations', async () => {
    // Act
    let result = await verifyPassword('test', 'pbkdf2_sha256$0$salt$hash')

    // Assert
    assert.ok(!result, 'should handle zero iterations')
  })

  it('verifyPassword returns false for a hash with invalid base64url salt', async () => {
    // Act
    let result = await verifyPassword('test', 'pbkdf2_sha256$100000$!!!$dGVzdA')

    // Assert
    assert.ok(!result, 'should handle invalid base64url salt')
  })

  it('verifyPassword returns false for a hash with invalid base64url hash', async () => {
    // Act
    let result = await verifyPassword('test', 'pbkdf2_sha256$100000$dGVzdA$!!!')

    // Assert
    assert.ok(!result, 'should handle invalid base64url hash')
  })

  it('verifyPassword returns false for a hash with empty salt segment', async () => {
    // Act
    let result = await verifyPassword('test', 'pbkdf2_sha256$100000$$hash')

    // Assert
    assert.ok(!result, 'should handle empty salt segment')
  })

  it('verifyPassword returns false for a hash with empty hash segment', async () => {
    // Act
    let result = await verifyPassword('test', 'pbkdf2_sha256$100000$salt$')

    // Assert
    assert.ok(!result, 'should handle empty hash segment')
  })

  // -----------------------------------------------------------------------
  // Structural: verifyPassword returns false (never throws) for any input
  // -----------------------------------------------------------------------

  it('verifyPassword does not throw for any string input', async () => {
    // Arrange
    let inputs = ['', 'not-a-hash', '$$$', 'pbkdf2_sha256$$$', 'pbkdf2_sha256$abc$!!!$???']

    for (let input of inputs) {
      // Act — should never throw; we just need the promise to settle
      let rejected = false
      try {
        await verifyPassword('any-password', input)
      } catch {
        rejected = true
      }
      assert.ok(!rejected, `should not throw for input: ${JSON.stringify(input)}`)
    }
  })
})
