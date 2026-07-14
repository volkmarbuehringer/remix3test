export interface ApiErrorBody {
  error: string
  fieldErrors?: Record<string, string>
}

export function apiError(message: string, status: number, fieldErrors?: Record<string, string>) {
  let body: ApiErrorBody = { error: message }
  if (fieldErrors && Object.keys(fieldErrors).length > 0) {
    body.fieldErrors = fieldErrors
  }
  return Response.json(body, { status })
}

export function validationError(
  issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> }>,
  status = 400,
) {
  let fieldErrors = issuesToFieldErrors(issues)
  return apiError('Validation failed.', status, fieldErrors)
}

export function unauthorized(message = 'Authentication required.') {
  return apiError(message, 401)
}

export function notFound(message = 'Not found.') {
  return apiError(message, 404)
}

export function forbidden(message = 'Forbidden.') {
  return apiError(message, 403)
}

export function fieldError(field: string, message: string, status: number) {
  return apiError(message, status, { [field]: message })
}

export function methodNotAllowed(message = 'Method not allowed.') {
  return apiError(message, 405)
}

export function conflict(message: string, fieldErrors?: Record<string, string>) {
  return apiError(message, 409, fieldErrors)
}

export function tooManyRequests(message = 'Too many requests. Try again later.') {
  return apiError(message, 429)
}

function issuesToFieldErrors(
  issues: ReadonlyArray<{ message: string; path?: ReadonlyArray<unknown> }>,
): Record<string, string> {
  let errors: Record<string, string> = {}
  for (let issue of issues) {
    let field = issue.path?.[0]
    if (typeof field === 'string' && field !== '' && !errors[field]) {
      errors[field] = issue.message
    }
  }
  return errors
}
