export const PASSWORD_MIN_LENGTH = 10
export const DIGIT_RE = /[0-9]/
export const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/

export function validatePasswordComplexity(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (!DIGIT_RE.test(password)) {
    return 'Password must contain at least one number.'
  }
  if (!SPECIAL_RE.test(password)) {
    return 'Password must contain at least one special character.'
  }
  return null
}
