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
