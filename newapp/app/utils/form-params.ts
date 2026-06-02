export function encodeFormValues(keys: readonly string[], parsed: Record<string, string>): Record<string, string> {
  let params: Record<string, string> = {}
  for (let key of keys) {
    if (parsed[key]) params[`fv_${key}`] = parsed[key]
  }
  return params
}

export function decodeFormValues(keys: readonly string[], url: URL): Record<string, string> | undefined {
  let values: Record<string, string> = {}
  let hasAny = false
  for (let key of keys) {
    let val = url.searchParams.get(`fv_${key}`)
    if (val !== null) {
      values[key] = val
      hasAny = true
    }
  }
  return hasAny ? values : undefined
}

export function encodeFieldErrors(errors: Record<string, string>): Record<string, string> {
  let params: Record<string, string> = {}
  for (let [k, v] of Object.entries(errors)) {
    params[`fe_${k}`] = v
  }
  return params
}

export function decodeFieldErrors(keys: readonly string[], url: URL): Record<string, string> | undefined {
  let errors: Record<string, string> = {}
  let hasAny = false
  for (let key of keys) {
    let val = url.searchParams.get(`fe_${key}`)
    if (val !== null) {
      errors[key] = val
      hasAny = true
    }
  }
  return hasAny ? errors : undefined
}
