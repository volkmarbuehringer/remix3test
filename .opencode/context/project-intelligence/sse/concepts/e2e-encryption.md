<!-- Context: sse/concepts/e2e-encryption | Priority: high | Version: 1.0 | Updated: 2026-03-24 -->

# E2E Encryption Concept

End-to-end encryption using AES-256-GCM with Web Crypto API. Only clients can read messages; server stores/transmits encrypted data without decryption capability.

## Quick Reference

- **Purpose**: Secure message encryption/decryption
- **Use When**: Adding encryption to SSE messaging, online/offline messages
- **Audience**: Developers implementing secure chat

## How It Works

```
Sender                      Server                       Recipient
  │                           │                             │
  │  [plaintext]              │                             │
  ├──► encrypt(key) ──────►  │                             │
  │     ↓                     │                             │
  │  [encrypted] ────────────►│  [encrypted] ────────────►│
  │                           │     ↓                      │
  │                           │                    decrypt(key)
  │                           │                             │
  │                           │                        [plaintext]
```

## Encryption Flow

```typescript
// 1. Generate random salt and IV
let salt = crypto.getRandomValues(new Uint8Array(16))
let iv = crypto.getRandomValues(new Uint8Array(12))

// 2. Derive key from password using PBKDF2
let key = await deriveKey(password, salt)

// 3. Encrypt plaintext
let encrypted = await crypto.subtle.encrypt(
  { name: 'AES-GCM', iv },
  key,
  new TextEncoder().encode(plaintext),
)

// 4. Combine salt + iv + ciphertext → base64
let combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
combined.set(salt, 0)
combined.set(iv, salt.length)
combined.set(new Uint8Array(encrypted), salt.length + iv.length)
return btoa(String.fromCharCode(...combined))
```

## Decryption Flow

```typescript
// 1. Decode base64 → combined bytes
let combined = new Uint8Array(
  atob(encryptedText)
    .split('')
    .map((c) => c.charCodeAt(0)),
)

// 2. Extract salt, iv, ciphertext
let salt = combined.slice(0, 16)
let iv = combined.slice(16, 28)
let ciphertext = combined.slice(28)

// 3. Derive key and decrypt
let key = await deriveKey(password, salt)
let decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
return new TextDecoder().decode(decrypted)
```

## Key Derivation (PBKDF2)

```typescript
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  let encoder = new TextEncoder()
  let keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}
```

## Message Format

```
┌─────────────────────────────────────────────┐
│ base64 string (80 bytes when plaintext < 20)│
├──────────┬─────────┬───────────────────────┤
│ salt     │ IV      │ ciphertext            │
│ 16 bytes │ 12 bytes│ remaining bytes      │
└──────────┴─────────┴───────────────────────┘
```

## Security Properties

| Property           | Implementation              |
| ------------------ | --------------------------- |
| **Encryption**     | AES-256-GCM (authenticated) |
| **Key Derivation** | PBKDF2 with 100k iterations |
| **Hash Function**  | SHA-256                     |
| **Randomness**     | crypto.getRandomValues()    |

## When Encryption Fails

```typescript
try {
  let decrypted = await decrypt(encryptedText, password)
  if (decrypted.includes('[encrypted')) {
    // Wrong key or corrupted data
    showError('Cannot decrypt: wrong key')
  }
} catch {
  // Decryption error
}
```

## Key Storage

- **In-memory**: Encryption key stored in JS variable during session
- **localStorage**: Key optionally persisted for auto-rejoin
- **NOT on server**: Server never sees plaintext or keys

## 📂 Codebase References

**Implementation**: `demos/sse/app/assets/message-stream.tsx` (encrypt/decrypt functions)
**Database**: `demos/sse/app/db.ts` (encrypted column in messages table)

## Related

- `lookup/offline-message-flow.md` - Combining encryption with offline storage
- `errors/sse-encryption-errors.md` - Troubleshooting encryption issues
