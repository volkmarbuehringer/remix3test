const PG_RESTRICT_VIOLATION = '23001' as const
const PG_FOREIGN_KEY_VIOLATION = '23503' as const

export function isConstraintViolation(error: unknown): boolean {
  if (error && typeof error === 'object') {
    let err = error as { code?: string; cause?: { code?: string } }
    if (err.code === PG_RESTRICT_VIOLATION || err.code === PG_FOREIGN_KEY_VIOLATION) return true
    if (err.cause?.code === PG_RESTRICT_VIOLATION || err.cause?.code === PG_FOREIGN_KEY_VIOLATION) return true
  }
  return false
}
