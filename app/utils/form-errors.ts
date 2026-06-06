export interface ValidationOk { ok: true }

export interface ValidationFail {
  ok: false
  fieldErrors: Record<string, string>
}

export type ValidationResult = ValidationOk | ValidationFail
