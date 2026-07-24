/**
 * Shared logger utility.
 *
 * - In test environments, logs are suppressed to avoid noise.
 * - In production, logs flow through to console.
 *
 * Usage:
 *   let log = createLogger('[MyModule]')
 *   log('processing...', data)
 *   log.error('something went wrong', err)
 */

type LogFn = (...args: unknown[]) => void

export interface Logger {
  (...args: unknown[]): void
  error: LogFn
}

export function createLogger(prefix: string): Logger {
  let isTest = process.env.NODE_ENV === 'test'

  let logFn: Logger = Object.assign(
    (...args: unknown[]) => {
      if (isTest) return
      console.log(prefix, ...args)
    },
    {
      error: (...args: unknown[]) => {
        if (isTest) return
        console.error(prefix, ...args)
      },
    },
  )

  return logFn
}
