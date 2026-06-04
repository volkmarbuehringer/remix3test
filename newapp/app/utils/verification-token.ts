const TOKEN_BYTES = 32
const VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000

export function generateToken(): string {
  let bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES))
  return Buffer.from(bytes).toString('base64url')
}

export function verificationExpires(): number {
  return Date.now() + VERIFICATION_EXPIRY_MS
}
