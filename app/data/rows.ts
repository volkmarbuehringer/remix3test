import type { Database, SqlStatement } from 'remix/data-table'
import { z } from 'zod/v4'

/**
 * Decodes an int8 aggregate column (`count`, `sum`, `min`, `max`, `avg`) to a
 * number. node-postgres returns int8 values as strings; aggregates are always
 * coerced at the decoding boundary because a string count is never useful.
 */
export const int8Aggregate = z.coerce.number()

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

/**
 * Execute a raw SQL statement and validate every returned row against `schema`.
 * Returns the typed, validated rows; throws {@link RawRowError} on any mismatch.
 */
export async function queryRows<Schema extends z.ZodType>(
  db: Database,
  statement: string | SqlStatement,
  schema: Schema,
): Promise<z.output<Schema>[]> {
  let result = await db.exec(statement)
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
): Promise<z.output<Schema> | undefined> {
  let rows = await queryRows(db, statement, schema)
  return rows[0]
}
