/**
 * Parsers for untrusted pagination values.
 *
 * Grids pass these straight into `LIMIT`/`OFFSET`. `Number('1e30')` is finite
 * and `Number('1.5')` is a number, but neither is a safe integer and Postgres
 * rejects both as a bigint (`invalid input syntax for type bigint`), turning
 * `?offset=1e30` into a 500. `Number.isFinite` is therefore not a sufficient
 * guard here: only a non-negative safe integer is accepted.
 */

/** Parse a grid offset; anything that is not a non-negative safe integer is 0. */
export function parseOffsetParam(raw: string | null | undefined): number {
  let value = Number(raw ?? '')
  return Number.isSafeInteger(value) && value > 0 ? value : 0
}

/** Parse a 1-based page number; anything that is not a safe integer ≥ 1 is 1. */
export function parsePageParam(raw: string | null | undefined): number {
  let value = Number(raw ?? '')
  return Number.isSafeInteger(value) && value >= 1 ? value : 1
}
