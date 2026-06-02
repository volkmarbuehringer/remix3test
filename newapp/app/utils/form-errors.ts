export interface ValidationOk { ok: true }

export interface ValidationFail {
  ok: false
  fieldErrors: Record<string, string>
}

export type ValidationResult = ValidationOk | ValidationFail

export function fieldErrorsFromResult(result: ValidationResult): Record<string, string> | undefined {
  return result.ok ? undefined : result.fieldErrors
}
