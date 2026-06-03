/**
 * Parse BIGINT columns (returned as strings by the PostgreSQL driver) back to numbers.
 * The DB schema (migrate.ts) uses BIGINT, but the ORM maps them as c.integer().
 */
export function parseIntFields(value: Record<string, unknown>, ...fields: string[]): void {
  for (let field of fields) {
    if (typeof value[field] === 'string') {
      value[field] = parseInt(value[field] as string, 10)
    }
  }
}

export function issuesToFieldErrors(issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> }>): Record<string, string> {
  let errors: Record<string, string> = {}
  for (let issue of issues) {
    let field = issue.path?.[0]
    if (typeof field === 'string' && field !== '') {
      if (!errors[field]) errors[field] = issue.message
    }
  }
  return errors
}

export function readFormFieldValues(keys: readonly string[], formData: FormData): Record<string, string> {
  let values: Record<string, string> = {}
  for (let key of keys) {
    let v = formData.get(key)
    values[key] = typeof v === 'string' ? v : ''
  }
  return values
}
