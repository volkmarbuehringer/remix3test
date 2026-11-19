import { createRateLimiter } from './rate-limiter.ts'

/**
 * Shared, process-wide login lockout state.
 *
 * Both the browser login (`/auth/login`) and the token API (`/api/login`) draw
 * from the SAME budget. Separate limiter instances used to let an attacker
 * double the guess rate by alternating endpoints, and the API endpoint had no
 * escalating account lockout at all. Keys are normalized here so the two paths
 * cannot diverge (the browser form schema only trims, while the API lowercases).
 *
 * Only failed attempts consume the budget; a successful login resets the
 * per-email state. The IP bucket is deliberately not reset on success.
 *
 * State is in-memory and per-process, like every other limiter in this app.
 * Backing it with a shared store (Redis/PostgreSQL) is a separate follow-up.
 */

const shortLimiter = createRateLimiter({ windowMs: 15_000, perKey: true, maxAttempts: 5 })
const mediumLimiter = createRateLimiter({ windowMs: 5 * 60_000, perKey: true, maxAttempts: 15 })
const longLimiter = createRateLimiter({ windowMs: 60 * 60_000, perKey: true, maxAttempts: 30 })
const ipLimiter = createRateLimiter({ windowMs: 60_000, perKey: true, maxAttempts: 20 })

export type LoginBlockReason = 'short' | 'medium' | 'long' | 'ip'

export interface LoginRateLimitBlock {
  reason: LoginBlockReason
  retryAfterSeconds: number
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function normalizeIp(ip: string): string {
  // The server boundary stamps X-Client-Ip from the TCP socket; the fallback
  // only catches internal re-entries that skip the boundary. A shared bucket
  // fails toward lockout, never toward bypass.
  return ip || 'unknown'
}

/** Returns null when the attempt is allowed, otherwise the tier that blocked. */
export function checkLoginRateLimit(email: string, ip: string): LoginRateLimitBlock | null {
  let key = normalizeEmail(email)
  let ipKey = normalizeIp(ip)

  let long = longLimiter.check(key)
  if (!long.allowed) {
    return { reason: 'long', retryAfterSeconds: long.retryAfter ?? 3600 }
  }
  let medium = mediumLimiter.check(key)
  if (!medium.allowed) {
    return { reason: 'medium', retryAfterSeconds: medium.retryAfter ?? 300 }
  }
  let short = shortLimiter.check(key)
  if (!short.allowed) {
    return { reason: 'short', retryAfterSeconds: short.retryAfter ?? 15 }
  }
  let ipCheck = ipLimiter.check(ipKey)
  if (!ipCheck.allowed) {
    return { reason: 'ip', retryAfterSeconds: ipCheck.retryAfter ?? 60 }
  }
  return null
}

/** Count one failed login attempt against both the email and IP budgets. */
export function recordLoginFailure(email: string, ip: string): void {
  let key = normalizeEmail(email)
  shortLimiter.set(key)
  mediumLimiter.set(key)
  longLimiter.set(key)
  ipLimiter.set(normalizeIp(ip))
}

/** Clear the per-email failure state after a successful login. */
export function resetLoginFailures(email: string): void {
  let key = normalizeEmail(email)
  shortLimiter.reset(key)
  mediumLimiter.reset(key)
  longLimiter.reset(key)
}

/** Test-only: clear every login rate-limit entry, including the IP bucket. */
export function __resetLoginRateLimits(): void {
  shortLimiter.clear()
  mediumLimiter.clear()
  longLimiter.clear()
  ipLimiter.clear()
}
