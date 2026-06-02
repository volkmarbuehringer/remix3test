export function issuesToFieldErrors(issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> }>): Record<string, string> {
  let errors: Record<string, string> = {}
  for (let issue of issues) {
    let field = issue.path?.[0]
    if (typeof field === 'string' && !errors[field]) {
      errors[field] = issue.message
    }
    if (typeof field !== 'string' || field === '') {
      if (!errors._form) {
        errors._form = issue.message
      }
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
