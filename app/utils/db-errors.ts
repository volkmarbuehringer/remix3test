const PG_RESTRICT_VIOLATION = '23001' as const
const PG_FOREIGN_KEY_VIOLATION = '23503' as const
const PG_UNIQUE_VIOLATION = '23505' as const

export type PgErr = { code?: string; message?: string; constraint?: string; cause?: PgErr }

/**
 * Minimal guard for a Postgres/Node error object. The predicates below only
 * read optional fields, so any non-null object is a valid starting point and
 * the recursive `cause` chain is re-checked on each hop.
 */
function isPgErr(error: unknown): error is PgErr {
  return typeof error === 'object' && error !== null
}

function matchPg(err: unknown, pred: (e: PgErr) => boolean, seen?: WeakSet<object>): boolean {
  if (!isPgErr(err)) return false
  seen ??= new WeakSet()
  if (seen.has(err)) return false
  seen.add(err)
  return pred(err) || (err.cause ? matchPg(err.cause, pred, seen) : false)
}

export function isConstraintViolation(error: unknown): boolean {
  return matchPg(
    error,
    (err) => err.code === PG_RESTRICT_VIOLATION || err.code === PG_FOREIGN_KEY_VIOLATION,
  )
}

export function isUniqueViolation(error: unknown): boolean {
  return matchPg(error, (err) => err.code === PG_UNIQUE_VIOLATION)
}

export function isExclusionConstraintError(error: unknown): boolean {
  return matchPg(
    error,
    (err) =>
      err.constraint === 'no_overlapping_seats' ||
      err.constraint === 'no_overlapping_offerings' ||
      err.code === '23P01' ||
      (err.message ?? '').includes('conflicts with key'),
  )
}
