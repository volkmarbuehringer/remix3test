import { getCurrentUserSafely } from './context.ts'

function getUserLogId(): string {
  let user = getCurrentUserSafely()
  if (user) {
    return `user:${user.id}`
  }
  return 'guest'
}

export function userLogger(prefix: string) {
  let userId = getUserLogId()

  function log(...args: unknown[]) {
    console.log(`[${prefix}] [${userId}]`, ...args)
  }

  function warn(...args: unknown[]) {
    console.warn(`[${prefix}] [${userId}]`, ...args)
  }

  function error(...args: unknown[]) {
    console.error(`[${prefix}] [${userId}]`, ...args)
  }

  return { log, warn, error }
}
