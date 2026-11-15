import * as s from 'remix/data-schema'

/**
 * A text schema that trims before any length/format check runs.
 *
 * The guide's form schema trims first (`node_modules/remix/guides/08-data-and-validation.md`
 * §"Define the input schema") so a whitespace-only value fails the required
 * check instead of passing `minLength` and then being trimmed to `''` by the
 * table's `beforeWrite` hook — which rejects the write and turns the request
 * into a 500. Compose it before `pipe(...)`:
 *
 * ```ts
 * f.field(s.defaulted(trimmedText(), '').pipe(minLength(1)))
 * ```
 */
export function trimmedText() {
  return s.string().transform((value) => value.trim())
}

/**
 * Decode BIGINT (int8) columns, which node-postgres returns as strings, to
 * numbers. Returns a new record so the row handed to `afterRead` is never
 * mutated in place.
 */
export function decodeInt8Fields(
  value: Record<string, unknown>,
  ...fields: string[]
): Record<string, unknown> {
  let next = { ...value }
  for (let field of fields) {
    if (typeof next[field] === 'string') {
      next[field] = Number(next[field])
    }
  }
  return next
}

export function issuesToFieldErrors(
  issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> | undefined }>,
): Record<string, string> {
  let errors: Record<string, string> = {}
  for (let issue of issues) {
    let field = issue.path?.[0]
    if (typeof field === 'string' && field !== '') {
      if (!errors[field]) errors[field] = issue.message
    }
  }
  return errors
}

export function readFormFieldValues(
  keys: readonly string[],
  formData: FormData,
): Record<string, string> {
  let values: Record<string, string> = {}
  for (let key of keys) {
    let v = formData.get(key)
    values[key] = typeof v === 'string' ? v : ''
  }
  return values
}
