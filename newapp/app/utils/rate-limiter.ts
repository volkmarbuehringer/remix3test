export interface RateLimiterOptions {
  /** Time window in milliseconds */
  windowMs: number
  /** Track per-user (by ID) vs global */
  perUser?: boolean
  /** Cleanup interval for per-user maps (default: windowMs * 100) */
  cleanupInterval?: number
}

export interface RateLimiter {
  check(userId?: number): { allowed: boolean; retryAfter?: number }

  set(userId?: number): void

  reset(userId?: number): void

  /** Atomically checks and sets. Returns false if rate-limited. */
  attempt(userId?: number): boolean
}

export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  let { windowMs, perUser = false, cleanupInterval = windowMs * 100 } = options

  let GLOBAL_KEY = -1
  let timestamps = new Map<number, number>()

  let cleanupTimer: ReturnType<typeof setInterval> | undefined
  if (perUser) {
    cleanupTimer = setInterval(() => {
      let now = Date.now()
      for (let [key, time] of timestamps) {
        if (now - time > cleanupInterval) {
          timestamps.delete(key)
        }
      }
    }, cleanupInterval)

    if (cleanupTimer.unref) {
      cleanupTimer.unref()
    }
  }

  function getKey(userId?: number): number {
    if (perUser) {
      if (userId == null) {
        throw new Error('userId is required for per-user rate limiter')
      }
      return userId
    }
    return GLOBAL_KEY
  }

  return {
    check(userId?: number): { allowed: boolean; retryAfter?: number } {
      let key = getKey(userId)
      let lastTime = timestamps.get(key) ?? 0
      let now = Date.now()

      if (now - lastTime < windowMs) {
        let retryAfter = Math.ceil((windowMs - (now - lastTime)) / 1000)
        return { allowed: false, retryAfter }
      }

      return { allowed: true }
    },

    set(userId?: number): void {
      let key = getKey(userId)
      timestamps.set(key, Date.now())
    },

    attempt(userId?: number): boolean {
      let result = this.check(userId)
      if (!result.allowed) return false
      this.set(userId)
      return true
    },

    reset(userId?: number): void {
      if (perUser && userId != null) {
        timestamps.delete(userId)
      } else {
        timestamps.delete(GLOBAL_KEY)
      }
    },
  }
}
