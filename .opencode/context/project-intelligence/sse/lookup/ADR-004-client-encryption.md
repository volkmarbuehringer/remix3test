<!-- Context: sse/decisions/ADR-004-client-encryption | Priority: high | Version: 1.0 | Updated: 2026-03-25 -->

# ADR-004: Client-Side Encryption

**Status**: accepted  
**Date**: 2026-03-22  
**Context**: demos/sse | **Module**: message-stream.tsx (lines 72-155, 632-637)  
**Related Tasks**: N/A  
**Related ADRs**: ADR-002

---

## Context

The SSE demo allows users to send sensitive messages that should only be readable by intended recipients.

**Problem**: How should message confidentiality be achieved without the server ever seeing plaintext?

## Decision

Implement end-to-end encryption in the browser using the Web Crypto API:

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: PBKDF2 with SHA-256, 100,000 iterations
- **Key Storage**: Client-side only (never sent to server)
- **Message format**: Salt (16 bytes) + IV (12 bytes) + ciphertext, base64 encoded

```typescript
async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  let keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return window.crypto.subtle.deriveKey(
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

## Alternatives Considered

### Option 1: Server-Side Encryption with Key Management

- **Pros**: More control, can search encrypted messages, supports key recovery
- **Cons**: Server sees plaintext, requires trusted server infrastructure, key management complexity
- **Why rejected**: Trust model requires server never to see plaintext

### Option 2: TLS/SSL Only

- **Pros**: Simple, transparent to application, handles encryption in transit
- **Cons**: Server sees plaintext, no end-to-end guarantee (MITM possible at server)
- **Why rejected**: Doesn't meet confidentiality requirement (server shouldn't read messages)

### Option 3: Third-Party E2E Library (libsignal, etc.)

- **Pros**: Battle-tested, handles key agreement, forward secrecy
- **Cons**: Large dependency, protocol complexity, overkill for simple use case
- **Why rejected**: Additional complexity not justified for demo scope

### Option 4: No Encryption

- **Pros**: Simplest implementation, full searchability
- **Cons**: No privacy guarantee, messages visible to server and network observers
- **Why rejected**: Privacy feature requested by demo requirements

## Consequences

### Positive

- Server never sees plaintext — true end-to-end privacy
- Uses browser's native Web Crypto API — no external dependencies
- AES-256-GCM provides authentication (tampering detected)
- PBKDF2 with high iteration count protects against brute-force
- Encryption key stays in browser — no key transmission needed

### Negative

- No key recovery (if password forgotten, messages unreadable)
- No forward secrecy (compromised key exposes all messages)
- Larger message size (salt + IV overhead per message)
- Requires JavaScript — no encryption without JS enabled

### Neutral

- Appropriate for demos and sensitive local communication
- Production use should evaluate key management and recovery needs

---

## Implementation Notes

The encryption key is entered by the user and stored in browser `localStorage`. The server receives already-encrypted messages and stores/transmits them as-is. The `encrypted` flag in the broadcast indicates to recipients that decryption is needed.
