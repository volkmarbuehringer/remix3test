import type { Database, SqlStatement } from 'remix/data-table'
import { z } from 'zod/v4'

import { getRequestSignal } from '../utils/request-signal.ts'

/**
 * Decodes an int8 (BIGINT) column to a number. node-postgres returns int8
 * values as strings, so every raw-SQL read of one decodes at this boundary.
 */
export const int8 = z.coerce.number()

/** Decodes an int8 aggregate column (`count`, `sum`, `min`, `max`, `avg`). */
export const int8Aggregate = int8

/**
 * Thrown when a raw query row fails its schema. Names the failing statement and
 * row index so drift between SQL and its schema surfaces immediately.
 */
export class RawRowError extends Error {
  constructor(statement: string, index: number, cause: unknown) {
    let text =
      typeof cause === 'object' && cause !== null && 'message' in cause
        ? String((cause as { message: unknown }).message)
        : String(cause)
    super(
      `Raw query row ${index} failed schema validation.\nStatement: ${statement}\nCause: ${text}`,
    )
    this.name = 'RawRowError'
  }
}

function statementText(statement: string | SqlStatement): string {
  return typeof statement === 'string' ? statement : statement.text
}

export interface QueryOptions {
  /** Explicit signal; defaults to the current request's signal, if any. */
  signal?: AbortSignal | undefined
}

function querySignal(options?: QueryOptions): AbortSignal | undefined {
  return options?.signal ?? getRequestSignal()
}

/**
 * Execute a raw SQL statement and validate every returned row against `schema`.
 * Returns the typed, validated rows; throws {@link RawRowError} on any mismatch.
 *
 * Raw reads are signal-aware: the helper refuses to start after an abort and
 * checks the signal once the query settles, so a disconnected request does not
 * issue more reads. The Postgres driver has no cancellation hook for an
 * already-started query, so that query runs to completion (bounded by the
 * pool's statement_timeout) before the abort reason is thrown.
 */
export async function queryRows<Schema extends z.ZodType>(
  db: Database,
  statement: string | SqlStatement,
  schema: Schema,
  options?: QueryOptions,
): Promise<z.output<Schema>[]> {
  let signal = querySignal(options)
  signal?.throwIfAborted()

  let result = await db.exec(statement)
  signal?.throwIfAborted()

  let rows = result.rows ?? []
  return rows.map((row, index) => {
    let parsed = schema.safeParse(row)
    if (!parsed.success) {
      throw new RawRowError(statementText(statement), index, parsed.error)
    }
    return parsed.data
  })
}

/**
 * Execute a raw SQL statement and validate the first returned row against
 * `schema`. Returns `undefined` when the query returns no rows.
 */
export async function queryRow<Schema extends z.ZodType>(
  db: Database,
  statement: string | SqlStatement,
  schema: Schema,
  options?: QueryOptions,
): Promise<z.output<Schema> | undefined> {
  let rows = await queryRows(db, statement, schema, options)
  return rows[0]
}
