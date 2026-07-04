const PG_RESTRICT_VIOLATION = '23001' as const
const PG_FOREIGN_KEY_VIOLATION = '23503' as const

export type PgErr = { code?: string; message?: string; constraint?: string; cause?: PgErr }

function matchPg(err: PgErr | undefined, pred: (e: PgErr) => boolean, seen?: WeakSet<object>): boolean {
  if (!err || typeof err !== 'object') return false
  seen ??= new WeakSet()
  if (seen.has(err)) return false
  seen.add(err)
  return pred(err) || (err.cause ? matchPg(err.cause, pred, seen) : false)
}

export function isConstraintViolation(error: unknown): boolean {
  return matchPg(error as PgErr, (err) =>
    err.code === PG_RESTRICT_VIOLATION || err.code === PG_FOREIGN_KEY_VIOLATION,
  )
}

export function isExclusionConstraintError(error: unknown): boolean {
  return matchPg(error as PgErr, (err) =>
    err.constraint === 'no_overlapping_seats' ||
    err.code === '23P01' ||
    (err.message ?? '').includes('conflicts with key'),
  )
}
