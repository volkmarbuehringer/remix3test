export interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number
  /** Track per-user (by ID) vs global */
  perUser?: boolean
  /** Track per-key by string (email, IP, etc.) */
  perKey?: boolean
  /** Max attempts within the window before blocking (default: 1 for throttle) */
  maxAttempts?: number
  /** Cleanup interval for per-user maps (default: windowMs * 100) */
  cleanupInterval?: number
}

interface RateLimiterEntry {
  attempts: number
  firstAt: number
}

export interface RateLimiter {
  check(key?: number | string): { allowed: boolean; retryAfter?: number }

  set(key?: number | string): void

  reset(key?: number | string): void

  /** Atomically checks and sets. Returns false if rate-limited. */
  attempt(key?: number | string): boolean

  /** Return the current state for a key (count, remaining, reset seconds), or null if no entry. */
  state(key?: number | string): { count: number; remaining: number; reset: number } | null
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  let { windowMs, perUser = false, perKey = false, maxAttempts = 1, cleanupInterval = windowMs * 100 } = options

  if (perUser && perKey) {
    throw new Error('Cannot set both perUser and perKey on a rate limiter')
  }

  let GLOBAL_KEY = Symbol('global')
  let entries = new Map<number | string | symbol, RateLimiterEntry>()

  let hasKeyedMode = perUser || perKey
  let cleanupTimer: ReturnType<typeof setInterval> | undefined
  if (hasKeyedMode) {
    cleanupTimer = setInterval(() => {
      let now = Date.now()
      for (let [key, entry] of entries) {
        if (now - entry.firstAt > cleanupInterval) {
          entries.delete(key)
        }
      }
    }, cleanupInterval)

    if (cleanupTimer.unref) {
      cleanupTimer.unref()
    }
  }

  function getKey(key?: number | string): number | string | symbol {
    if (perUser) {
      if (key == null || typeof key !== 'number') {
        throw new Error('userId is required for per-user rate limiter')
      }
      return key
    }
    if (perKey) {
      if (key == null || typeof key !== 'string') {
        throw new Error('key is required for per-key rate limiter')
      }
      return key
    }
    return GLOBAL_KEY
  }

  function entryCount(key: number | string | symbol): number {
    let entry = entries.get(key)
    if (!entry) return 0
    if (Date.now() - entry.firstAt > windowMs) {
      entries.delete(key)
      return 0
    }
    return entry.attempts
  }

  return {
    check(key?: number | string): { allowed: boolean; retryAfter?: number } {
      let k = getKey(key)
      let count = entryCount(k)
      if (count >= maxAttempts) {
        let entry = entries.get(k)!
        let retryAfter = Math.ceil((windowMs - (Date.now() - entry.firstAt)) / 1000)
        return { allowed: false, retryAfter }
      }
      return { allowed: true }
    },

    set(key?: number | string): void {
      let k = getKey(key)
      let entry = entries.get(k)
      let now = Date.now()
      if (!entry || now - entry.firstAt > windowMs) {
        entries.set(k, { attempts: 1, firstAt: now })
      } else {
        entry.attempts++
      }
    },

    attempt(key?: number | string): boolean {
      let k = getKey(key)
      let count = entryCount(k)
      if (count >= maxAttempts) return false
      let entry = entries.get(k)
      let now = Date.now()
      if (!entry || now - entry.firstAt > windowMs) {
        entries.set(k, { attempts: 1, firstAt: now })
      } else {
        entry.attempts++
      }
      return true
    },

    state(key?: number | string): { count: number; remaining: number; reset: number } | null {
      let k = getKey(key)
      let count = entryCount(k)
      let entry = entries.get(k)
      if (!entry) {
        return { count: 0, remaining: maxAttempts, reset: 0 }
      }
      let elapsed = Date.now() - entry.firstAt
      return {
        count,
        remaining: Math.max(0, maxAttempts - count),
        reset: Math.max(0, Math.ceil((windowMs - elapsed) / 1000)),
      }
    },

    reset(key?: number | string): void {
      if (hasKeyedMode && key != null) {
        entries.delete(key)
      } else {
        entries.delete(GLOBAL_KEY)
      }
    },
  }
}
