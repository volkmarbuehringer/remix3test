import { createHash, randomBytes } from 'node:crypto'

const TOKEN_BYTES = 32
const TOKEN_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000

export function generateApiToken(): string {
  let bytes = randomBytes(TOKEN_BYTES)
  return 'tok_' + bytes.toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function computeTokenExpiry(): number {
  return Date.now() + TOKEN_EXPIRY_MS
}
