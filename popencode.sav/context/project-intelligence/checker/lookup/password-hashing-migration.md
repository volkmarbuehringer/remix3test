<!-- Context: project-intelligence/checker/lookup/password-hashing-migration | Priority: high | Version: 1.0 | Updated: 2026-04-20 -->

# Password Hashing Migration: bcrypt to Node.js Crypto

> Migrated from bcrypt package to Node.js built-in crypto for PostgreSQL compatibility.

## Migration Summary

| Aspect | Before (bcrypt) | After (Node.js crypto) |
|-------|-----------------|----------------------|
| Package | `bcrypt` | None (built-in) |
| Algorithm | bcrypt | PBKDF2 |
| Iterations | 10 (bcrypt default) | 100,000 |
| Hash Function | - | SHA-512 |
| Output | bcrypt hash | `salt:hash` (both base64) |
| Storage | PostgreSQL TEXT | PostgreSQL TEXT |

## Hash Format

```typescript
// Format: salt:hash (both base64 encoded)
// Example: abc123def456==:xyz789uvw012==
return `${salt}:${hash}`
```

## Why This Migration?

**Root Cause:** PostgreSQL's `crypt()` and `gen_salt()` functions require the `pgcrypto` extension, which was not available in the deployment environment.

**Solution:** Use Node.js built-in crypto to hash passwords before storage, eliminating the need for PostgreSQL-specific cryptographic functions.

## Files Modified

| File | Changes |
|------|---------|
| `checker/app/utils/password.ts` | Replaced bcrypt with PBKDF2 implementation |
| `checker/app/controllers/auth/login/controller.tsx` | Uses `verifyPasswordByEmail()` |
| `checker/app/data/setup.ts` | Uses `hashPasswordWithPool()` for migrations and admin user |
| `checker/package.json` | Removed `bcrypt` and `@types/bcrypt` |

## Implementation

```typescript
// checker/app/utils/password.ts
import crypto from 'node:crypto'

const ITERATIONS = 100000
const HASH_LENGTH = 64 // bytes

export async function hashPassword(password: string): Promise<string> {
  let salt = crypto.randomBytes(16).toString('base64')
  let hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, HASH_LENGTH, 'sha512').toString('base64')
  return `${salt}:${hash}`
}

function verifyHash(password: string, storedHash: string): boolean {
  let [salt, expectedHash] = storedHash.split(':')
  if (!salt || !expectedHash) return false
  
  let hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, HASH_LENGTH, 'sha512').toString('base64')
  return hash === expectedHash
}
```

## Usage

```typescript
import { hashPasswordWithPool, verifyPasswordByEmail, DEFAULT_ADMIN_PASSWORD } from '../utils/password.ts';

// Hash password for storage
let hashed = await hashPasswordWithPool(pool, 'user-password')

// Verify login
let user = await verifyPasswordByEmail(pool, 'user@example.com', 'user-password')
if (user) {
  // Login successful
}
```

## Default Admin Credentials

| Property | Value |
|----------|-------|
| Email | `admin@example.com` |
| Password | `admin123` |
| Override | Set `DEFAULT_ADMIN_PASSWORD` env var |

## Migration Support

The `setup.ts` includes automatic migration for plaintext passwords:

```typescript
async function migratePasswords(): Promise<void> {
  // Find plaintext passwords only (not already hashed with :)
  let result = await pool.query(
    `SELECT id, email, password_hash FROM users 
     WHERE password_hash NOT LIKE '%:%'`
  )
  // Migrate each plaintext password to hashed format
}
```

## Security Notes

- PBKDF2 with 100,000 iterations provides strong protection against brute-force
- Random 16-byte salt prevents rainbow table attacks
- SHA-512 produces 64-byte hash (encoded as ~88 chars base64)
- Consider increasing iterations periodically as hardware improves
- `crypto.randomBytes()` is used for cryptographically secure random salt generation

## Related

- Checker login implementation: `../guides/login-implementation.md`
- Database setup: `../../development/remix3/guides/database-initialization.md`
- PostgreSQL migration: `../../development/remix3/guides/postgresql-migration.md`